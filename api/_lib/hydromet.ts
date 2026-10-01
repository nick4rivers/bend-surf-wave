/**
 * USBR Pacific Northwest Hydromet client.
 *
 * All flow and canal data for the site comes straight from Hydromet, so there is
 * no third-party aggregator in the loop. Station / parameter codes used:
 *
 *   wico q   Deschutes R. below Wickiup Dam (cfs, 15-min)
 *   beno q   Deschutes R. at Benham Falls (cfs, 15-min)
 *   beno wf  Deschutes R. at Benham Falls water temperature (°C, 15-min)
 *   lapo q   Little Deschutes R. near La Pine (cfs, 15-min)
 *   ceno qc  Central Oregon Canal diversion (cfs, 15-min)
 *   arno qc  Arnold Canal diversion (cfs, 15-min; often reports a step late)
 *   debo q   Deschutes R. below Bend = USGS 14070500 (cfs, 15-min)
 *
 *   Daily equivalents (pn-bin/daily.pl): beno qd, ceno qj, arno qj, wico qd, lapo qd
 *
 * Hydromet timestamps are local Pacific time ("YYYY-MM-DD HH:MM"); we keep them
 * as naive local strings, which is what the frontend already expects.
 */

import { fetchUrl } from "./http";

const HYDROMET_BASE = "https://www.usbr.gov/pn-bin";

export interface HydrometTable {
  /** Column names as requested, e.g. ["beno q", "ceno qc"] */
  columns: string[];
  /** Rows in time order; missing values are NaN. */
  rows: Array<{ date: string; values: number[] }>;
}

function parseHydrometCsv(text: string, columns: string[]): HydrometTable {
  const lines = text.trim().split(/\r?\n/);
  const rows: HydrometTable["rows"] = [];
  // Skip the header line; data lines look like "2026-10-01 13:30,1120.00 ,262.00 ,"
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const date = parts[0]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;
    const values = columns.map((_, c) => {
      // parseFloat tolerates Hydromet quality flags such as "11.70-"
      const v = parseFloat((parts[c + 1] ?? "").trim());
      return Number.isFinite(v) ? v : NaN;
    });
    rows.push({ date, values });
  }
  return { columns, rows };
}

const listParam = (columns: string[]) => columns.map((c) => encodeURIComponent(c)).join(",");

/** 15-minute instantaneous data. Give either `backHours` or a start/end date (YYYY-MM-DD). */
export async function fetchHydrometInstant(
  columns: string[],
  opts: { backHours?: number; start?: string; end?: string }
): Promise<HydrometTable> {
  const range = opts.start
    ? `&start=${opts.start}${opts.end ? `&end=${opts.end}` : ""}`
    : `&back=${opts.backHours ?? 24}`;
  const url = `${HYDROMET_BASE}/v1/instant.pl?list=${listParam(columns)}${range}&format=csv`;
  return parseHydrometCsv(await fetchUrl(url), columns);
}

/** Daily mean data between two dates (YYYY-MM-DD). */
export async function fetchHydrometDaily(columns: string[], start: string, end: string): Promise<HydrometTable> {
  const url = `${HYDROMET_BASE}/daily.pl?list=${listParam(columns)}&start=${start}&end=${end}&format=csv`;
  return parseHydrometCsv(await fetchUrl(url), columns);
}

/**
 * Carry the last good value forward over gaps (used for canal gages that report late).
 * Leading gaps take the first reported value; `fallback` is used only if nothing reported.
 */
export function forwardFill(values: number[], fallback = NaN): number[] {
  let last = values.find((v) => Number.isFinite(v)) ?? fallback;
  return values.map((v) => {
    if (Number.isFinite(v)) last = v;
    return last;
  });
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
