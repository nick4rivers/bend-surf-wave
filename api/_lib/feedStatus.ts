/**
 * Freshness checks for live gage feeds.
 *
 * Hydromet timestamps are naive Pacific wall-clock strings ("YYYY-MM-DD HH:MM").
 * GOES-transmitted gages normally post within about an hour, so a reading older
 * than STALE_AFTER_HOURS means the feed has stopped, and the site should say so
 * instead of presenting that reading as current.
 */
import type { FeedStatus } from "../../src/types";

export const STALE_AFTER_HOURS = 3;

/** "YYYY-MM-DD HH:MM" → ms, treating the wall clock as UTC (for differences only). */
export const naiveMs = (s: string): number => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
};

/** Current Pacific wall-clock time on the same naive scale as naiveMs. */
export function pacificNowMs(now = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
}

/** Today's date in Pacific time, YYYY-MM-DD. */
export const pacificToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

/**
 * Build a FeedStatus from the newest real reading (or null if the request failed / returned nothing).
 * `label` names the feed in the visitor-facing message, e.g. "the USBR Hydromet flow gages".
 */
export function feedStatus(lastReading: string | null, label: string, maxAgeHours = STALE_AFTER_HOURS): FeedStatus {
  if (!lastReading) {
    return {
      available: false,
      stale: false,
      lastReading: null,
      message: `No data is coming back from ${label} right now, so current readings are unavailable.`,
    };
  }
  const ageH = (pacificNowMs() - naiveMs(lastReading)) / 3.6e6;
  if (!Number.isFinite(ageH) || ageH > maxAgeHours) {
    return {
      available: false,
      stale: true,
      lastReading,
      message: `No new readings have come in from ${label} for over ${maxAgeHours} hours, so current readings are unavailable.`,
    };
  }
  return { available: true, stale: false, lastReading };
}
