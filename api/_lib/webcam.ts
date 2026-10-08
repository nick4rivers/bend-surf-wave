import { fetchUrl } from "./http.js";

/**
 * Bend Whitewater Park webcam, streamed on YouTube by The Bulletin (@bendbulletin).
 *
 * Why this exists: a YouTube live stream gets a brand-new video ID every time the
 * broadcaster restarts it (power blip, encoder reboot, stream hitting a length limit).
 * The site used to hardcode one video ID, so every restart left a dead embed until
 * someone edited the code. Instead we ask YouTube which stream the channel is live
 * with right now, and fall back to the last ID that worked.
 */
export const PARK_CAM_CHANNEL_ID = "UC5NGBccFc9inD-62NMKGtVg"; // The Bulletin
/** Embed that the viewer's browser resolves to whatever the channel is live with right now. */
export const PARK_CAM_CHANNEL_EMBED = `https://www.youtube.com/embed/live_stream?channel=${PARK_CAM_CHANNEL_ID}`;
export const PARK_CAM_STREAMS_URL = "https://www.youtube.com/@bendbulletin/streams";
/** Last known-good stream ID (updated 2026-10-08). Only used if live lookup fails. */
export const PARK_CAM_FALLBACK_VIDEO_ID = "kMjtqZC1_qI";
/** The channel could run other live streams (meetings, events); only accept the park cam. */
const TITLE_MATCH = /whitewater|surf wave|river cam/i;
const CHECK_TTL_MS = 5 * 60 * 1000;

export interface ParkCamStatus {
  videoId: string;
  /** true = confirmed live, false = channel has no live park stream, null = couldn't check */
  isLive: boolean | null;
  title?: string;
  checkedAt: string;
  source: "live-lookup" | "env-override" | "last-known";
  /** Short explanation of what the YouTube lookup saw, for debugging from /api/surf-data */
  lookupNote?: string;
}

let lastGoodVideoId: string | null = null;
let cached: { status: ParkCamStatus; at: number } | null = null;

/**
 * Pure parser so it can be checked without network access.
 * `state` is only "live"/"offline" when the page clearly says so; anything we don't
 * recognize (bot check, consent wall, layout change) is "unknown", never "offline".
 */
export function parseLivePage(html: string): {
  videoId: string | null;
  state: "live" | "offline" | "unknown";
  title: string | null;
  note: string;
} {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
  const videoId = canonical?.match(/youtube\.com\/watch\?v=([\w-]{11})/)?.[1] ?? null;
  const rawTitle = html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? null;
  const title = rawTitle ? rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') : null;
  const liveNow = /"isLiveNow":true/.test(html) || /"isLive":true/.test(html);
  const notLiveNow = /"isLiveNow":false/.test(html) || /"isUpcoming":true/.test(html);

  if (videoId && liveNow) return { videoId, state: "live", title, note: `watch page, live: ${title ?? "?"}` };
  if (videoId && notLiveNow) return { videoId, state: "offline", title, note: `watch page, not live now: ${title ?? "?"}` };
  if (canonical && /youtube\.com\/(channel\/|@)/.test(canonical)) {
    // /live redirected to the channel home page: the channel has no live stream
    return { videoId: null, state: "offline", title, note: "channel page, no live stream" };
  }
  const pageTitle = html.match(/<title>([^<]{0,80})/)?.[1]?.trim() ?? "no <title>";
  return { videoId, state: "unknown", title, note: `unrecognized page (${html.length} bytes, "${pageTitle}")` };
}

export async function getParkCamStatus(): Promise<ParkCamStatus> {
  const now = Date.now();
  if (cached && now - cached.at < CHECK_TTL_MS) return cached.status;

  const checkedAt = new Date().toISOString();
  const override = process.env.PARK_CAM_VIDEO_ID?.trim();
  let status: ParkCamStatus;

  if (override) {
    status = { videoId: override, isLive: null, checkedAt, source: "env-override" };
  } else {
    try {
      const html = await fetchUrl(
        `https://www.youtube.com/channel/${PARK_CAM_CHANNEL_ID}/live`,
        {
          // Real-browser headers + consent cookie so YouTube serves the watch page, not a consent wall
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+1",
        },
        6000
      );
      const { videoId, state, title, note } = parseLivePage(html);
      if (state === "live" && videoId && (!title || TITLE_MATCH.test(title))) {
        lastGoodVideoId = videoId;
        status = { videoId, isLive: true, title: title ?? undefined, checkedAt, source: "live-lookup", lookupNote: note };
      } else {
        status = {
          videoId: lastGoodVideoId ?? PARK_CAM_FALLBACK_VIDEO_ID,
          // A live stream with an unexpected title is "unknown", not offline
          isLive: state === "offline" ? false : null,
          checkedAt,
          source: "last-known",
          lookupNote: state === "live" ? `live stream title didn't match park cam: ${title}` : note,
        };
      }
    } catch (err) {
      console.warn("Park cam live lookup failed:", (err as Error).message);
      status = {
        videoId: lastGoodVideoId ?? PARK_CAM_FALLBACK_VIDEO_ID,
        isLive: null,
        checkedAt,
        source: "last-known",
        lookupNote: `lookup failed: ${(err as Error).message}`,
      };
    }
  }

  cached = { status, at: now };
  return status;
}
