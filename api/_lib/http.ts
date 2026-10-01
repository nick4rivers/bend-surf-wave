import https from "https";
import http from "http";

/** Minimal GET helper with redirect following and a timeout. */
export function fetchUrl(url: string, customHeaders?: Record<string, string>, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BendSurfReport/1.0; +https://bendsurfreport.com)",
          Accept: "application/json, text/csv, text/plain, */*",
          ...customHeaders,
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, customHeaders, timeoutMs).then(resolve).catch(reject);
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}
