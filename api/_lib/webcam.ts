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
}

let lastGoodVideoId: string | null = null;
let cached: { status: ParkCamStatus; at: number } | null = null;

/** Pure parser so it can be unit-checked without network access. */
export function parseLivePage(html: string): { videoId: string | null; isLive: boolean; title: string | null } {
  const videoId =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1] ?? null;
  const isLive = /"isLiveNow":true/.test(html) || /"isLive":true/.test(html);
  const rawTitle = html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? null;
  const title = rawTitle ? rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') : null;
  return { videoId, isLive, title };
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
      const { videoId, isLive, title } = parseLivePage(html);
      if (videoId && isLive && (!title || TITLE_MATCH.test(title))) {
        lastGoodVideoId = videoId;
        status = { videoId, isLive: true, title: title ?? undefined, checkedAt, source: "live-lookup" };
      } else {
        // Page loaded fine but the channel isn't live with the park cam right now
        status = {
          videoId: lastGoodVideoId ?? PARK_CAM_FALLBACK_VIDEO_ID,
          isLive: false,
          checkedAt,
          source: "last-known",
        };
      }
    } catch (err) {
      console.warn("Park cam live lookup failed:", (err as Error).message);
      status = {
        videoId: lastGoodVideoId ?? PARK_CAM_FALLBACK_VIDEO_ID,
        isLive: null,
        checkedAt,
        source: "last-known",
      };
    }
  }

  cached = { status, at: now };
  return status;
}
