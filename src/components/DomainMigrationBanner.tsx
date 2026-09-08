import React, { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";

export const DomainMigrationBanner: React.FC = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user previously dismissed banner in this session
    const isDismissed = sessionStorage.getItem("bend_migration_banner_dismissed") === "true";
    if (isDismissed) {
      setShouldShow(false);
      return;
    }

    const host = window.location.hostname.toLowerCase();

    // Do NOT render if the visitor is already on the production domain
    if (host === "bendsurfreport.com" || host === "www.bendsurfreport.com") {
      setShouldShow(false);
      return;
    }

    // Render for any external or temporary preview domains (e.g. AI Studio, Vercel, Firebase)
    setShouldShow(true);
  }, []);

  const handleDismiss = () => {
    setShouldShow(false);
    try {
      sessionStorage.setItem("bend_migration_banner_dismissed", "true");
    } catch {
      // Ignore storage errors if disabled
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      id="domain-migration-banner"
      role="alert"
      className="relative overflow-hidden rounded-xl border border-sky-200/90 bg-gradient-to-r from-sky-50 via-cyan-50/50 to-blue-50/80 p-4 sm:p-5 shadow-sm text-slate-800 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Top right dismiss button on mobile/desktop */}
      <button
        id="migration-banner-dismiss-btn"
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-100/70 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-6 pr-8 sm:pr-10">
        {/* Messaging */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              🌊 We&apos;ve Moved!
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-200/70 text-sky-800">
              Official Domain Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            The Bend Surf Report has a new home. Please update your bookmarks to{" "}
            <a
              href="https://www.bendsurfreport.com"
              className="font-semibold text-sky-700 underline hover:text-sky-800 decoration-sky-400 underline-offset-2"
            >
              bendsurfreport.com
            </a>
            .
          </p>
        </div>

        {/* Action button */}
        <div className="pt-1 sm:pt-0 sm:self-center shrink-0">
          <a
            id="migration-banner-redirect-btn"
            href="https://www.bendsurfreport.com"
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors whitespace-nowrap"
          >
            <span>Go to bendsurfreport.com</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
