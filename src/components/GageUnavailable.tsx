import React from "react";
import { AlertTriangle } from "lucide-react";
import type { FeedStatus } from "../types";

/** "YYYY-MM-DD HH:MM" (Pacific wall clock) → "Oct 16, 8:15 AM" without timezone shifting. */
export function formatGageTime(s?: string | null): string | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const month = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = +m[3];
  if (m[4] === undefined) return `${month} ${day}`;
  const h = +m[4];
  return `${month} ${day}, ${((h + 11) % 12) + 1}:${m[5]} ${h < 12 ? "AM" : "PM"}`;
}

const HYDROMET_URL = "https://www.usbr.gov/pn/hydromet/";

interface GageUnavailableProps {
  status?: FeedStatus;
  /** What is missing, e.g. "Flow data" */
  what: string;
  /** Dark styling for use inside the dark hero card */
  dark?: boolean;
  className?: string;
}

/** Plain notice shown in place of a reading or chart when a gage feed is down or stale. */
export const GageUnavailable: React.FC<GageUnavailableProps> = ({ status, what, dark = false, className = "" }) => {
  const last = formatGageTime(status?.lastReading);
  const message = status?.message ?? "The USBR Hydromet gages are not reporting right now.";
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg border p-3.5 text-xs leading-relaxed ${
        dark ? "border-amber-400/30 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"
      } ${className}`}
    >
      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? "text-amber-300" : "text-amber-600"}`} />
      <div className="space-y-1">
        <p className="font-semibold">{what} currently unavailable</p>
        <p className={dark ? "text-amber-100/80" : "text-amber-800"}>
          {message}
          {last && <> Last reading received: {last}.</>} The site will update automatically when the gages are back.
        </p>
        <a
          href={HYDROMET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block underline underline-offset-2 ${dark ? "text-amber-200" : "text-amber-700"}`}
        >
          USBR Hydromet status
        </a>
      </div>
    </div>
  );
};

/** Stand-in for a whole chart card when its feed returned no data at all. */
export const UnavailableCard: React.FC<{ title: string; status?: FeedStatus; what: string }> = ({ title, status, what }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">{title}</h3>
    <GageUnavailable status={status} what={what} />
  </div>
);
