// Google Analytics 4 (gtag.js) for bendsurfreport.com.
//
// The measurement ID is public (it appears in every page's source), so it lives
// in code. GA only loads on the production domain, so Vercel previews and local
// dev never send data and never skew the numbers.

const GA_MEASUREMENT_ID = "G-HE0X7R3ZCF";
const PRODUCTION_HOSTS = ["bendsurfreport.com", "www.bendsurfreport.com"];

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let enabled = false;

export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!PRODUCTION_HOSTS.includes(window.location.hostname)) return;
  if (enabled) return;
  enabled = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag must push the `arguments` object itself, not an array copy.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

// Tabs switch in place without a page load, so GA can't see them on its own.
// Send a custom event per switch to measure which tabs people actually use.
export function trackTabView(tab: string): void {
  if (!enabled || !window.gtag) return;
  window.gtag("event", "tab_view", { tab_name: tab });
}
