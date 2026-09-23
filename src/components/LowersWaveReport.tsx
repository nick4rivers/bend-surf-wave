import React, { useState } from "react";
import {
  Waves,
  Calendar,
  CheckCircle2,
  Info,
  ArrowRight,
} from "lucide-react";
import { SurfDataResponse, UnitType } from "../types";
import {
  getLowersCurrentStatus,
  WEEKLY_SCHEDULE,
  TUNE_PROFILES,
} from "../utils/lowersWave";

interface LowersWaveReportProps {
  data: SurfDataResponse;
  unit: UnitType;
  onNavigateToFlow?: () => void;
}

export const LowersWaveReport: React.FC<LowersWaveReportProps> = ({
  data,
  unit,
  onNavigateToFlow,
}) => {
  const status = getLowersCurrentStatus();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(status.dayIndex);

  const selectedSchedule = WEEKLY_SCHEDULE[selectedDayIndex];
  const selectedProfile = TUNE_PROFILES[selectedSchedule.tuneType];
  const isCurrentSurfWave = status.todaySchedule.tuneType === "surf-wave";

  const displayFlow = (cfs: number) => {
    if (unit === "metric") {
      return `${(cfs * 0.0283168).toFixed(1)} m³/s`;
    }
    return `${cfs} CFS`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner: Today's Active Tune */}
      <div
        id="lowers-hero-banner"
        className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl"
      >
        <div
          className={`absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isCurrentSurfWave ? "bg-emerald-400" : "bg-sky-400"
          }`}
        />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-sky-400 border border-slate-700">
              <Waves className="w-3.5 h-3.5 text-sky-400" />
              Jason&apos;s Wave &bull; Lowers
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Lowers Report &mdash;{" "}
              <span
                className={
                  isCurrentSurfWave ? "text-emerald-400" : "text-sky-400"
                }
              >
                {status.todayProfile.title} ({status.todayProfile.optimization})
              </span>
            </h1>
          </div>

          {/* Today's Tune Summary Card */}
          <div
            className={`p-4 sm:p-5 rounded-xl border backdrop-blur-sm ${
              isCurrentSurfWave
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-100"
                : "bg-sky-950/40 border-sky-500/30 text-sky-100"
            }`}
          >
            <div className="space-y-2">
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                {status.todayProfile.fullDescription}
              </p>
              <div className="pt-1 flex flex-wrap gap-2 text-xs font-semibold">
                {status.todayProfile.pros.map((pro, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/60 text-slate-200 border border-slate-700/60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {pro}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Tuning Schedule Selector (7-Day Interactive Matrix) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <h2 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Weekly Wave Shaper Schedule
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tuned on alternate days:{" "}
              <strong className="text-slate-700">Surf Wave</strong> on Mon, Wed,
              Fri, Sun &bull; <strong className="text-slate-700">Wave Hole</strong>{" "}
              on Tue, Thu, Sat
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Surf Wave
            </span>
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Wave Hole
            </span>
          </div>
        </div>

        {/* 7-Day Day Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4">
          {WEEKLY_SCHEDULE.map((item) => {
            const isToday = item.dayIndex === status.dayIndex;
            const isSelected = item.dayIndex === selectedDayIndex;
            const isSurf = item.tuneType === "surf-wave";

            return (
              <button
                key={item.dayIndex}
                type="button"
                id={`lowers-day-btn-${item.shortDay.toLowerCase()}`}
                onClick={() => setSelectedDayIndex(item.dayIndex)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? isSurf
                      ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/40 shadow-sm"
                      : "bg-sky-50 border-sky-400 ring-2 ring-sky-400/40 shadow-sm"
                    : "bg-slate-50/70 hover:bg-slate-100/80 border-slate-200 text-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900">
                      {item.dayName}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white leading-none">
                        TODAY
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isSurf
                        ? "bg-emerald-100/70 text-emerald-800 border-emerald-300"
                        : "bg-sky-100/70 text-sky-800 border-sky-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSurf ? "bg-emerald-600" : "bg-sky-600"
                      }`}
                    />
                    {isSurf ? "Surf Wave" : "Wave Hole"}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                  {isSurf ? "Glassy & low-gradient" : "Friendly foam pile"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Details Box */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {selectedSchedule.dayName} Tune &mdash; {selectedProfile.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              {selectedProfile.fullDescription}
            </p>
          </div>

          <div className="shrink-0 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-mono">
              Recommended Craft
            </span>
            <span>
              {selectedSchedule.tuneType === "surf-wave"
                ? "Longboard Surfboards & Kayaks"
                : "Kayaks, Boogie Boards & Short Longboards"}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side In-Depth Tuning Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Surf Wave Profile Card */}
        <div
          id="surf-wave-profile-card"
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-900 text-base">
                  Surf Wave Tuning
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Mon &bull; Wed &bull; Fri &bull; Sun
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Craft Compatibility &amp; Recommendations
              </h4>

              <div className="space-y-2">
                {TUNE_PROFILES["surf-wave"].idealCrafts.map((craft, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 mb-0.5">
                      <span>{craft.craft}</span>
                      <span className="text-[11px] text-emerald-700 font-bold">
                        {craft.verdict}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-snug">
                      {craft.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Wave Hole Profile Card */}
        <div
          id="wave-hole-profile-card"
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-500" />
                <h3 className="font-bold text-slate-900 text-base">
                  Wave Hole Tuning
                </h3>
              </div>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                Tue &bull; Thu &bull; Sat
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Craft Compatibility &amp; Recommendations
              </h4>

              <div className="space-y-2">
                {TUNE_PROFILES["wave-hole"].idealCrafts.map((craft, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 mb-0.5">
                      <span>{craft.craft}</span>
                      <span className="text-[11px] text-sky-700 font-bold">
                        {craft.verdict}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-snug">
                      {craft.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Craft Guide Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
            Craft Guide for Jason&apos;s Wave
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How different board types and watercraft match the current river setup
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Longboard Surfboard */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Longboard</h3>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  Best: Surf Wave
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ideal on <strong className="text-slate-800">Surf Wave</strong> days
                (Mon, Wed, Fri, Sun). Shorter high-volume longboards also work OK on
                Wave Hole days.
              </p>
            </div>
          </div>

          {/* Whitewater Kayak */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Kayak</h3>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                  All Week
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mellow front surfs on <strong className="text-slate-800">Surf Wave</strong>{" "}
                days. Spins, side-surfing, and play in the pile on{" "}
                <strong className="text-slate-800">Wave Hole</strong> days.
              </p>
            </div>
          </div>

          {/* Boogie Board */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Boogie Board</h3>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                  Best: Wave Hole
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Great on <strong className="text-slate-800">Wave Hole</strong> days
                (Tue, Thu, Sat) with the friendly foam pile pushing you back into
                the sweet spot.
              </p>
            </div>
          </div>

          {/* Shortboard */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Shortboard</h3>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  Upper Wave Best
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Low-volume shortboards generally need the steeper pneumatic Green
                Wave upstream. On Lowers, high volume is key.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bend Whitewater Park River Context */}
      <div className="bg-slate-900 text-slate-200 rounded-xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-white text-base">
                Understanding the Park Layout
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Bend Whitewater Park features multiple river hydraulic gates: the{" "}
              <strong className="text-white font-semibold">Upper Green Wave</strong> (the
              main steep surfing wave) and the{" "}
              <strong className="text-white font-semibold">Lowers (Jason&apos;s Wave)</strong>,
              custom-shaped on alternate days for longboards, kayaks, and boogie
              boards.
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              Current river discharge at Bend Whitewater Park:{" "}
              <span className="font-mono text-sky-400 font-bold">
                {displayFlow(data.current.flowCfs)}
              </span>
            </p>
          </div>

          {onNavigateToFlow && (
            <button
              id="lowers-to-flow-btn"
              type="button"
              onClick={onNavigateToFlow}
              className="shrink-0 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2"
            >
              <Waves className="w-4 h-4" />
              View River Flow Data
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
