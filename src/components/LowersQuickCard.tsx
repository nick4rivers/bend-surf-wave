import React from "react";
import { Waves, Sparkles, ArrowRight } from "lucide-react";
import { getLowersCurrentStatus } from "../utils/lowersWave";

interface LowersQuickCardProps {
  onNavigateToLowers: () => void;
}

export const LowersQuickCard: React.FC<LowersQuickCardProps> = ({ onNavigateToLowers }) => {
  const status = getLowersCurrentStatus();
  const isSurfWave = status.todaySchedule.tuneType === "surf-wave";

  return (
    <div
      id="lowers-quick-card"
      className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-xl text-white hover:border-slate-700 transition-all flex flex-col justify-between"
    >
      {/* Background glow matching active optimization */}
      <div
        className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isSurfWave ? "bg-emerald-400" : "bg-sky-400"
        }`}
      />

      <div className="relative z-10">
        {/* Header line with title, optimization badge, and guide link */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-sky-400 border border-slate-700/60 shadow-sm">
              <Waves className="w-4 h-4 text-sky-400" />
            </span>
            <h3 className="font-bold text-white text-sm sm:text-base leading-tight">
              Lowers Wave Report
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shadow-xs ${
                isSurfWave
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-sky-500/20 text-sky-300 border-sky-400/30"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {isSurfWave ? "Surfer Optimized • Surf Wave" : "Kayak Optimized • Wave Hole"}
            </span>

            <button
              id="view-lowers-tab-btn"
              type="button"
              onClick={onNavigateToLowers}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors ml-1"
            >
              <span>Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Current Tuning & Optimization Callout (Dark Theme) */}
        <div
          className={`p-3.5 rounded-lg border backdrop-blur-sm ${
            isSurfWave
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-100"
              : "bg-sky-950/40 border-sky-500/30 text-sky-100"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                isSurfWave ? "text-emerald-400" : "text-sky-400"
              }`}
            >
              Today&apos;s Tune &bull; {status.dayName} &bull;{" "}
              {isSurfWave ? "Surfer Optimized" : "Kayak Optimized"}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-200 leading-snug">
            {isSurfWave
              ? "Surfer Optimized: Glassy low-gradient wave \u2014 ideal for surfing your favorite longboard, with a mellow front surf in your kayak."
              : "Kayak Optimized: Friendly wave-hole with a nice pile \u2014 ideal for mellow spins in your kayak, boogie boards & short longboards."}
          </p>
        </div>
      </div>
    </div>
  );
};
