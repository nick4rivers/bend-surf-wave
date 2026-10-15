import React from "react";
import { Waves } from "lucide-react";
import { SurfDataResponse } from "../types";
import { buildSurfReport } from "../utils/surfReport";

interface SurfReportTextProps {
  data: SurfDataResponse;
  unit: "imperial" | "metric";
}

/** Plain-language report built from the live data (see utils/surfReport.ts). */
export const SurfReportText: React.FC<SurfReportTextProps> = ({ data, unit }) => {
  const report = buildSurfReport(data, unit);
  if (!report) return null;

  return (
    <div className="space-y-1.5 max-w-2xl">
      <div className="flex items-center gap-2 text-[11px] font-medium text-sky-400">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 font-mono tracking-wide uppercase text-[10px]">
          <Waves className="w-3 h-3 text-sky-400" />
          Surf Report
        </span>
      </div>
      <p className="text-slate-200 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">{report}</p>
    </div>
  );
};
