/**
 * Head of Park flow model — Deschutes River at the Bend Whitewater Park.
 *
 * There is no gage at the park, so flow there is estimated from upstream gages:
 *
 *   Q_park(t) = k · Q_BENO(t − τ) − Q_CENO(t) − Q_ARNO(t)
 *
 *   k  BENO loss factor (default 0.93). Inherited from the rmmanalytics estimate
 *      this replaces, which used exactly 0.93·BENO − CENO − ARNO with no lag.
 *      PROVISIONAL: it has no documented basis. For comparison, Hydromet records
 *      show DEBO (USGS 14070500, below Bend) runs at a median ~0.88 of BENO in
 *      winter when the gaged canals are off, so a few-percent loss between
 *      Benham Falls and the park is plausible, but 0.93 is not calibrated.
 *
 *   τ  travel time of a flow change (kinematic-wave celerity, not water velocity)
 *      from Benham Falls to the park = river distance / celerity.
 *      - Distance BENO → park: ~20 river km (measured in GIS).
 *      - Celerity: ~2.3 km/h, calibrated from 18 isolated Wickiup release steps
 *        (2023–2026) between WICO and BENO (65 km): median lag to 50% of the BENO
 *        response ≈ 28 h (range 21–34 h).
 *      - Gives τ ≈ 8.7 h → rounded to 8.75 h. Cross-check: BENO → DEBO (below the
 *        park) winter cross-correlation peaks at ~11 h, with the cleanest
 *        individual events at 8–13 h, so the park lag should be somewhat shorter
 *        than that. Consistent.
 *      The lower reach (Lava Island canyon) is steeper than WICO → BENO, so τ may
 *      be a bit shorter in reality. Validate against field / webcam observations.
 *
 *   Canal diversions are applied with no lag: both diversion points are close
 *   to the park relative to Benham Falls, and their gages report at the canal.
 *
 * Because of τ, the last τ hours of BENO data haven't reached the park yet. That
 * gives a short forecast "for free": holding the canals at their latest values,
 * we know Q_park for the next τ hours.
 *
 * All parameters can be overridden with environment variables (see below) without
 * a code change.
 */

const envNum = (name: string, fallback: number) => {
  const v = parseFloat(process.env[name] ?? "");
  return Number.isFinite(v) ? v : fallback;
};

export const HEAD_OF_PARK_MODEL = (() => {
  const benoFactor = envNum("HOP_BENO_FACTOR", 0.93);
  const benoToParkKm = envNum("HOP_BENO_TO_PARK_KM", 20);
  const celerityKmPerHour = envNum("HOP_CELERITY_KMH", 2.3);
  const rawLag = envNum("HOP_LAG_HOURS", benoToParkKm / celerityKmPerHour);
  // Round to the 15-minute data interval
  const lagHours = Math.round(rawLag * 4) / 4;
  return { benoFactor, benoToParkKm, celerityKmPerHour, lagHours };
})();

export interface GageRow {
  date: string; // "YYYY-MM-DD HH:MM" local
  beno: number;
  ceno: number;
  arno: number;
}

export interface ParkFlowPoint {
  date: string;
  cfs: number;
}

export interface HeadOfParkForecast {
  lagHours: number;
  benoFactor: number;
  benoToParkKm: number;
  celerityKmPerHour: number;
  /** Time of the latest BENO reading the estimate is based on */
  asOf: string;
  nowCfs: number;
  /** Flow expected at the end of the forecast window */
  horizonDate: string;
  horizonCfs: number;
  minCfs: number;
  maxCfs: number;
  trend: "rising" | "falling" | "steady";
  /** Change between now and the end of the window */
  changeCfs: number;
}

// ---- naive local-time helpers (treat local wall-clock strings as UTC for arithmetic) ----
const toMs = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
};
const fromMs = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

/** Linear interpolation of y at x within sorted xs; NaN outside the range. */
function interp(xs: number[], ys: number[], x: number): number {
  if (xs.length === 0 || x < xs[0] || x > xs[xs.length - 1]) return NaN;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  if (xs[lo] === x) return ys[lo];
  if (xs[hi] === x) return ys[hi];
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + f * (ys[hi] - ys[lo]);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeHeadOfPark(rows: GageRow[], model = HEAD_OF_PARK_MODEL) {
  const { benoFactor, lagHours } = model;
  const lagMs = lagHours * 3.6e6;
  const STEP_MS = 15 * 60 * 1000;

  // Valid BENO samples for interpolation
  const bx: number[] = [];
  const by: number[] = [];
  for (const r of rows) {
    const t = toMs(r.date);
    if (Number.isFinite(t) && Number.isFinite(r.beno)) {
      bx.push(t);
      by.push(r.beno);
    }
  }

  // Canals: carry last value forward (ARNO in particular reports late). Seed with the
  // first reported value so a gap at the start of the window isn't read as "canal off".
  const firstFinite = (vals: number[]) => vals.find((v) => Number.isFinite(v)) ?? 0;
  let lastC = firstFinite(rows.map((r) => r.ceno));
  let lastA = firstFinite(rows.map((r) => r.arno));
  const estimate: Array<ParkFlowPoint & { benoLagged: number }> = [];
  for (const r of rows) {
    if (Number.isFinite(r.ceno)) lastC = r.ceno;
    if (Number.isFinite(r.arno)) lastA = r.arno;
    const t = toMs(r.date);
    if (!Number.isFinite(t) || bx.length === 0 || t > bx[bx.length - 1]) continue;
    const benoLagged = interp(bx, by, t - lagMs);
    if (!Number.isFinite(benoLagged)) continue;
    estimate.push({ date: r.date, cfs: round1(Math.max(0, benoFactor * benoLagged - lastC - lastA)), benoLagged });
  }

  // Forecast: the next τ hours are already "in the pipe" between Benham Falls and the park
  const forecast: ParkFlowPoint[] = [];
  let summary: HeadOfParkForecast | null = null;
  if (bx.length > 0 && estimate.length > 0) {
    const lastBenoMs = bx[bx.length - 1];
    for (let t = lastBenoMs + STEP_MS; t <= lastBenoMs + lagMs + 1; t += STEP_MS) {
      const benoLagged = interp(bx, by, t - lagMs);
      if (!Number.isFinite(benoLagged)) continue;
      forecast.push({ date: fromMs(t), cfs: round1(Math.max(0, benoFactor * benoLagged - lastC - lastA)) });
    }

    const now = estimate[estimate.length - 1];
    const end = forecast.length ? forecast[forecast.length - 1] : now;
    const window = [now.cfs, ...forecast.map((f) => f.cfs)];
    const changeCfs = round1(end.cfs - now.cfs);
    summary = {
      lagHours,
      benoFactor,
      benoToParkKm: model.benoToParkKm,
      celerityKmPerHour: model.celerityKmPerHour,
      asOf: now.date,
      nowCfs: now.cfs,
      horizonDate: end.date,
      horizonCfs: end.cfs,
      minCfs: Math.min(...window),
      maxCfs: Math.max(...window),
      trend: changeCfs > 15 ? "rising" : changeCfs < -15 ? "falling" : "steady",
      changeCfs,
    };
  }

  return { estimate, forecast, summary };
}
