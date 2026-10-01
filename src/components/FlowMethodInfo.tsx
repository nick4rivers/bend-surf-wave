import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { SurfDataResponse } from "../types";

interface FlowMethodInfoProps {
  data: SurfDataResponse;
  className?: string;
}

/** Small "i" button that opens a short explanation of how Head of Park flow is estimated. */
export const FlowMethodInfo: React.FC<FlowMethodInfoProps> = ({ data, className = "" }) => {
  const [open, setOpen] = useState(false);
  const m = data.current.forecast;
  const lag = m?.lagHours ?? 8.75;
  const k = m?.benoFactor ?? 0.93;
  const km = m?.benoToParkKm ?? 20;
  const speed = m?.celerityKmPerHour ?? 2.3;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How is flow at the wave calculated?"
        title="How is flow at the wave calculated?"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition ${className || "text-slate-400 hover:text-sky-600 hover:bg-sky-50"}`}
      >
        <Info className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flow-method-title"
          >
            <div
              className="relative w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl p-5 text-sm text-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 id="flow-method-title" className="font-bold text-slate-900 text-base pr-6">
                How we estimate flow at the wave
              </h3>

              <p className="mt-3">
                There's no gage at the park, so we estimate it from USBR Hydromet gages upstream:
              </p>
              <p className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800">
                Park = {k} × Benham Falls ({lag} h ago) − Central Oregon Canal − Arnold Canal
              </p>

              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>
                  <span className="font-semibold text-slate-900">The lag:</span> a change in flow takes about{" "}
                  {lag} hours to travel the ~{km} river km from Benham Falls to the park (~{speed} km/h, measured
                  from past Wickiup release changes).
                </li>
                <li>
                  <span className="font-semibold text-slate-900">The outlook:</span> water already past Benham
                  Falls gives a ~{Math.round(lag)}-hour look ahead (dashed line), assuming canal diversions hold
                  steady.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">The {k} factor:</span> allows for water lost
                  between Benham Falls and the park.
                </li>
              </ul>

              <p className="mt-3 text-xs text-slate-500">
                It's an estimate. The lag and loss factor are still being checked against what we see at the wave.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
