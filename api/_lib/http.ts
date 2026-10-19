import https from "https";
import http from "http";

/**
 * Total time any one upstream source gets before it is treated as unavailable.
 *
 * The page can't render until every source has answered or given up, so this is the
 * worst-case wait one slow feed can add. Measured Oct 2026: USBR Hydromet, USGS and
 * Open-Meteo all answer in about 1-1.7 s on a cold request and ~0.1 s after that, so
 * 6 s leaves about 3x headroom. Override per call when a source genuinely needs longer.
 */
export const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Minimal GET helper with redirect following and a timeout.
 * `timeoutMs` is a total deadline for the whole request (including redirects), not an
 * idle timeout, so a server that trickles data slowly can't hold the page up either.
 */
export function fetchUrl(
  url: string,
  customHeaders?: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  deadline = Date.now() + timeoutMs
): Promise<string> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error(`Timeout fetching ${url}`));

    const client = url.startsWith("https") ? https : http;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BendSurfReport/1.0; +https://bendsurfreport.com)",
          Accept: "application/json, text/csv, text/plain, */*",
          ...customHeaders,
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return finish(() =>
            fetchUrl(res.headers.location!, customHeaders, timeoutMs, deadline).then(resolve, reject)
          );
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          res.resume();
          return finish(() => reject(new Error(`HTTP ${res.statusCode} fetching ${url}`)));
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => finish(() => resolve(data)));
        res.on("error", (err) => finish(() => reject(err)));
      }
    );

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timeout fetching ${url} (over ${timeoutMs} ms)`)));
      req.destroy();
    }, remaining);

    req.on("error", (err) => finish(() => reject(err)));
  });
}
