import React from "react";
import { Waves, Activity, Thermometer, Sparkles } from "lucide-react";
import { ActiveTab, UnitType } from "../types";
import { AboutDialog } from "./AboutDialog";
import { formatGageTime } from "./GageUnavailable";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unit?: UnitType;
  setUnit?: (unit: UnitType) => void;
  loading?: boolean;
  onRefresh?: () => void;
  lastUpdated?: string;
  currentCfs?: number | null;
  statusLabel?: string;
  currentWaterTempF?: number | null;
  /** false when the USBR flow gages are down or stale */
  flowAvailable?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  lastUpdated,
  currentCfs,
  statusLabel,
  currentWaterTempF,
  flowAvailable = true,
}) => {
  const tabs = [
    { id: "overview" as ActiveTab, label: "Live Overview", icon: Activity },
    { id: "lowers" as ActiveTab, label: "Lowers Report", icon: Sparkles },
    { id: "flow" as ActiveTab, label: "River Flow", icon: Waves },
    { id: "temperature" as ActiveTab, label: "Water & Air Temp", icon: Thermometer },
    { id: "historical" as ActiveTab, label: "Historic Flow Data", icon: Activity },
  ];

  const getWaterRating = (tempF?: number | null) => {
    if (typeof tempF !== "number" || isNaN(tempF)) return null;
    if (tempF >= 62) {
      return {
        label: "Balmy",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      };
    }
    if (tempF >= 58) {
      return {
        label: "Comfortable",
        badgeClass: "bg-sky-500/20 text-sky-300 border-sky-400/30",
      };
    }
    if (tempF >= 54) {
      return {
        label: "Cool",
        badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
      };
    }
    return {
      label: "Cold",
      badgeClass: "bg-blue-500/20 text-blue-300 border-blue-400/30",
    };
  };

  const getFlowBadgeClass = (label?: string) => {
    if (!label || !flowAvailable) return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    const l = label.toLowerCase();
    if (l.includes("below") || l.includes("very low")) {
      return "bg-rose-500/20 text-rose-300 border-rose-400/30";
    }
    if (l.includes("firing") || l.includes("awesome")) {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    }
    if (l.includes("surf") && !l.includes("low")) {
      return "bg-sky-500/20 text-sky-300 border-sky-400/30";
    }
    if (l.includes("low") || l.includes("skim") || l.includes("short")) {
      return "bg-amber-500/20 text-amber-300 border-amber-400/30";
    }
    return "bg-rose-500/20 text-rose-300 border-rose-400/30";
  };

  const formatReadingTime = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return dateStr;
      const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${monthDay}, ${time}`;
    } catch {
      return dateStr;
    }
  };

  // Hydromet times are Pacific wall-clock strings; format them as-is so they don't shift by viewer timezone
  const formattedUpdated = formatGageTime(lastUpdated) ?? formatReadingTime(lastUpdated);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[3.75rem] py-2 sm:py-2.5 gap-2">
          {/* Logo & Spot title with Last Updated from BENO discharge */}
          <div className="flex flex-col justify-center shrink-0">
            <div className="flex items-center gap-2">
              <p className="font-outfit font-bold text-[18px] sm:text-[23px] text-white tracking-tight whitespace-nowrap leading-none">
                BEND SURF <span className="text-sky-400 font-semibold">REPORT</span>
              </p>
              {flowAvailable ? (
                <span className="hidden xs:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 leading-none">
                  LIVE
                </span>
              ) : (
                <span className="hidden xs:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 leading-none">
                  GAGES DOWN
                </span>
              )}
            </div>
            {!flowAvailable && (
              <p
                id="header-last-updated"
                className="text-[10px] sm:text-xs text-amber-300 font-medium tracking-normal mt-1.5 leading-none"
              >
                USBR gage data unavailable{formattedUpdated ? ` · last reading ${formattedUpdated}` : ""}
              </p>
            )}
            {flowAvailable && formattedUpdated && (
              <p
                id="header-last-updated"
                className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-normal mt-1.5 flex items-center gap-1.5 leading-none"
              >
                <span>Updated:</span>
                <span className="text-sky-400 font-mono text-[12px] sm:text-[15px] font-normal">
                  {formattedUpdated}
                </span>
                <span className="text-slate-500 text-[11px] hidden xs:inline">
                  (BENO discharge)
                </span>
              </p>
            )}
          </div>

          {/* Right Station Info & Conditions Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
            <div className="hidden xl:flex items-center gap-5 mr-1">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-0.5">
                  Station
                </p>
                <p className="text-xs font-semibold text-white">
                  Head of Park (modeled)
                </p>
              </div>
            </div>

            {/* Current Flow & Rating badge (Always visible on mobile & desktop) */}
            {currentCfs != null && flowAvailable && (
              <div
                id="header-flow-badge"
                title="Deschutes River Flow at Bend Whitewater Park"
                className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs text-white font-bold font-mono whitespace-nowrap">
                  {currentCfs} <span className="text-[10px] text-slate-400 font-normal">CFS</span>
                </span>
                {statusLabel && (
                  <span
                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border whitespace-nowrap ${getFlowBadgeClass(
                      statusLabel
                    )}`}
                  >
                    {/* Short form so the badge fits on small phones */}
                    {statusLabel === "Below Recommended" ? "Very Low" : statusLabel}
                  </span>
                )}
              </div>
            )}

            {/* Current Water Temp & Rating badge (Always visible on mobile & desktop) */}
            {currentWaterTempF != null && (() => {
              const rating = getWaterRating(currentWaterTempF);
              return (
                <div
                  id="header-water-temp-badge"
                  title="Deschutes River Water Temperature (BENO Gauge, ~20 river km upstream of park)"
                  className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm"
                >
                  <Thermometer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-xs text-white font-bold font-mono whitespace-nowrap">
                    {currentWaterTempF}°F
                  </span>
                  {rating && (
                    <span
                      className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border whitespace-nowrap ${rating.badgeClass}`}
                    >
                      {rating.label}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-800">
        <div className="flex flex-1 min-w-0 space-x-1 overflow-x-auto py-2 scrollbar-none text-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
          <div className="shrink-0 pl-1 border-l border-slate-800">
            <AboutDialog />
          </div>
        </div>
      </div>
    </header>
  );
};
