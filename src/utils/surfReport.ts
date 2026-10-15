/**
 * Plain-language surf report for the Head of Park.
 *
 * Deterministic template, no AI. Four short sentences, each one skipped when its
 * data is missing rather than filled with a guess:
 *   1. Current flow and status
 *   2. Outlook for the next ~9 h (water already past Benham Falls; see api/_lib/headOfPark.ts)
 *   3. Change from this time yesterday
 *   4. Today's weather (and air quality, only at "Unhealthy" or worse)
 */
import type { SurfDataResponse } from "../types";

const PACIFIC_TZ = "America/Los_Angeles";

/** A change smaller than this (CFS) reads as "about the same". */
const SAME_AS_YESTERDAY_CFS = 10;
/** Only mention air quality at EPA "Unhealthy" (AQI 151) or worse. */
const AQI_MENTION_THRESHOLD = 151;

type Unit = "imperial" | "metric";

const flowStr = (cfs: number, unit: Unit) =>
  unit === "metric" ? `${(cfs * 0.0283168).toFixed(1)} m³/s` : `${Math.round(cfs)} CFS`;

const tempStr = (f: number, unit: Unit) =>
  unit === "metric" ? `${Math.round(((f - 32) * 5) / 9)}°C` : `${Math.round(f)}°F`;

/** "YYYY-MM-DD HH:MM" (local wall clock) → ms, treating it as UTC for arithmetic only. */
const toMs = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
};

/** Flow at the reading closest to 24 h before the latest one (must be within 1 h). */
export function flowThisTimeYesterday(series: { date: string; cfs: number }[]): number | undefined {
  if (series.length === 0) return undefined;
  const target = toMs(series[series.length - 1].date) - 24 * 3.6e6;
  let best: { cfs: number; gap: number } | undefined;
  for (const p of series) {
    const gap = Math.abs(toMs(p.date) - target);
    if (Number.isFinite(gap) && (!best || gap < best.gap)) best = { cfs: p.cfs, gap };
  }
  return best && best.gap <= 3.6e6 ? best.cfs : undefined;
}

/** WMO weather code (Open-Meteo daily) → short phrase. */
export function describeWeatherCode(code: number): string | undefined {
  if (code === 0) return "Sunny";
  if (code === 1) return "Mostly sunny";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return undefined;
}

/** Index of today's (Pacific) entry in Open-Meteo's daily arrays, which include past days. */
function todayIndex(dailyTimes: unknown): number {
  if (!Array.isArray(dailyTimes)) return -1;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: PACIFIC_TZ }); // YYYY-MM-DD
  return dailyTimes.indexOf(today);
}

export function buildSurfReport(data: SurfDataResponse, unit: Unit = "imperial"): string {
  const current = data.current;
  if (!current || !Number.isFinite(current.flowCfs)) return "";
  const nowCfs = current.flowCfs;
  const parts: string[] = [];

  // 1. Current flow
  parts.push(`${flowStr(nowCfs, unit)} at the Head of Park (${current.statusLabel}).`);

  // 2. Outlook from the Benham Falls travel-time model
  const fc = current.forecast;
  if (fc && Number.isFinite(fc.horizonCfs)) {
    const hours = Math.round(fc.lagHours);
    if (fc.trend === "rising") {
      parts.push(`Expected to rise to about ${flowStr(fc.horizonCfs, unit)} over the next ${hours} hours.`);
    } else if (fc.trend === "falling") {
      parts.push(`Expected to drop to about ${flowStr(fc.horizonCfs, unit)} over the next ${hours} hours.`);
    } else {
      parts.push(`Expected to hold steady over the next ${hours} hours.`);
    }
  }

  // 3. Compared with this time yesterday
  const yesterday = flowThisTimeYesterday(data.timeSeries?.flow ?? []);
  if (yesterday !== undefined) {
    const diff = nowCfs - yesterday;
    if (Math.abs(diff) < SAME_AS_YESTERDAY_CFS) {
      parts.push(`About the same as this time yesterday.`);
    } else {
      const amount = flowStr(Math.abs(diff), unit);
      parts.push(`${diff > 0 ? "Up" : "Down"} ${amount} from this time yesterday.`);
    }
  }

  // 4. Today's weather
  const daily = data.weather?.daily;
  const i = todayIndex(daily?.time);
  if (i >= 0) {
    const cond = describeWeatherCode(daily.weather_code?.[i]);
    const high = daily.temperature_2m_max?.[i];
    const highPart = Number.isFinite(high) ? `high near ${tempStr(high, unit)}` : "";
    if (cond && highPart) parts.push(`${cond} today, ${highPart}.`);
    else if (cond) parts.push(`${cond} today.`);
    else if (highPart) parts.push(`Today's ${highPart}.`);
  }

  // Air quality, only when it is a real health concern
  const aqi = data.airQuality?.aqi;
  if (typeof aqi === "number" && aqi >= AQI_MENTION_THRESHOLD) {
    const level = aqi >= 301 ? "hazardous" : aqi >= 201 ? "very unhealthy" : "unhealthy";
    parts.push(`Air quality is ${level} (AQI ${Math.round(aqi)}); limit heavy exertion.`);
  }

  return parts.join(" ");
}
