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
  source: "youtube-api" | "live-lookup" | "env-override" | "last-known";
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

const YT_API = "https://www.googleapis.com/youtube/v3";
const SEARCH_MIN_INTERVAL_MS = 60 * 60 * 1000; // search.list costs 100 quota units; at most hourly
let lastSearchAt = 0;

/**
 * Official YouTube Data API check (needs YOUTUBE_API_KEY). Cheap path, about 2 quota units:
 * the channel's recent uploads (live streams appear there) plus the last known stream,
 * then one videos.list call to see which is live. Free quota is 10,000 units/day.
 * Returns null if the API call fails, so the caller can fall back to the page lookup.
 */
async function lookupViaApi(key: string, checkedAt: string): Promise<ParkCamStatus | null> {
  try {
    const uploads = "UU" + PARK_CAM_CHANNEL_ID.slice(2);
    const pl = JSON.parse(
      await fetchUrl(`${YT_API}/playlistItems?part=contentDetails&maxResults=25&playlistId=${uploads}&key=${key}`, {}, 6000)
    );
    const ids = new Set<string>(
      (pl.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean)
    );
    if (lastGoodVideoId) ids.add(lastGoodVideoId);
    ids.add(PARK_CAM_FALLBACK_VIDEO_ID);

    const findLive = async (videoIds: string[]) => {
      const v = JSON.parse(
        await fetchUrl(`${YT_API}/videos?part=snippet&id=${videoIds.slice(0, 50).join(",")}&key=${key}`, {}, 6000)
      );
      return (v.items ?? []).find(
        (it: any) => it.snippet?.liveBroadcastContent === "live" && TITLE_MATCH.test(it.snippet?.title ?? "")
      );
    };

    let live = await findLive([...ids]);
    let note = `YouTube API: checked ${ids.size} recent videos`;

    // Rare backstop: a live stream that somehow isn't in recent uploads
    if (!live && Date.now() - lastSearchAt > SEARCH_MIN_INTERVAL_MS) {
      lastSearchAt = Date.now();
      const sr = JSON.parse(
        await fetchUrl(
          `${YT_API}/search?part=id&channelId=${PARK_CAM_CHANNEL_ID}&eventType=live&type=video&maxResults=5&key=${key}`,
          {},
          6000
        )
      );
      const liveIds = (sr.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean);
      if (liveIds.length) live = await findLive(liveIds);
      note += ", plus live search";
    }

    if (live) {
      lastGoodVideoId = live.id;
      return { videoId: live.id, isLive: true, title: live.snippet.title, checkedAt, source: "youtube-api", lookupNote: `${note}; live: ${live.snippet.title}` };
    }
    return {
      videoId: lastGoodVideoId ?? PARK_CAM_FALLBACK_VIDEO_ID,
      isLive: false,
      checkedAt,
      source: "youtube-api",
      lookupNote: `${note}; no live park-cam stream`,
    };
  } catch (err) {
    // Never echo the request URL: it contains the key
    console.warn("YouTube API lookup failed:", (err as Error).message.replace(/key=[^&\s]+/g, "key=***"));
    return null;
  }
}

export async function getParkCamStatus(): Promise<ParkCamStatus> {
  const now = Date.now();
  if (cached && now - cached.at < CHECK_TTL_MS) return cached.status;

  const checkedAt = new Date().toISOString();
  const override = process.env.PARK_CAM_VIDEO_ID?.trim();
  let status: ParkCamStatus;

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const apiStatus = !override && apiKey ? await lookupViaApi(apiKey, checkedAt) : null;

  if (override) {
    status = { videoId: override, isLive: null, checkedAt, source: "env-override" };
  } else if (apiStatus) {
    status = apiStatus;
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
