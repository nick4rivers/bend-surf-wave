import React from "react";
import {
  Waves,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ShieldCheck,
  Droplets,
  Wind,
  Info,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { SurfDataResponse, UnitType } from "../types";

interface MetricCardsProps {
  data: SurfDataResponse;
  unit: UnitType;
  onNavigateToFlow: () => void;
  onNavigateToTemp: () => void;
  onNavigateToCanals: () => void;
  onNavigateToWeather?: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  data,
  unit,
  onNavigateToFlow,
  onNavigateToTemp,
  onNavigateToCanals,
  onNavigateToWeather,
}) => {
  const current = data.current;
  const upstream = data.upstreamGages;
  const airQuality = data.airQuality || {
    aqi: 25,
    rating: "Fresh AF",
    category: "Good (0–50 AQI)",
    color: "emerald",
    description: "Pristine Cascade mountain air.",
    recommendation: "Ideal conditions for high-exertion river surfing.",
    pm2_5: 1.5,
    updatedAt: "Live",
  };

  // Convert helpers
  const displayFlow = (cfs: number | null | undefined) => {
    const val = typeof cfs === "number" && !isNaN(cfs) ? cfs : 0;
    if (unit === "metric") {
      return (val * 0.0283168).toFixed(1) + " m³/s";
    }
    return `${val} CFS`;
  };

  const displayTemp = (tempF: number | null | undefined) => {
    if (typeof tempF !== "number" || isNaN(tempF)) return "--°";
    if (unit === "metric") {
      return `${(((tempF - 32) * 5) / 9).toFixed(1)}°C`;
    }
    return `${tempF.toFixed(1)}°F`;
  };

  const flowDiff = current.flowTrendDiff;
  const isRising = flowDiff > 5;
  const isFalling = flowDiff < -5;

  return (
    <div className="space-y-6">
      {/* Alert Banner / Current Condition Hero (Professional Polish dark hero) */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                current.flowCfs >= 800
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                  : current.flowCfs >= 650
                  ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                  : current.flowCfs >= 550
                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-400/30"
              }`}>
                <Sparkles className="w-3 h-3" />
                {current.statusLabel}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Firing Threshold: &gt;{unit === "metric" ? (current.thresholds.awesome * 0.0283).toFixed(1) + " m³/s" : `${current.thresholds.awesome} CFS`}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
              Bend Surf Wave is{" "}
              <span className={`font-semibold ${
                current.flowCfs >= 800
                  ? "text-emerald-400"
                  : current.flowCfs >= 650
                  ? "text-sky-400"
                  : current.flowCfs >= 550
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}>
                {current.statusLabel.toUpperCase()}
              </span>
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {current.statusDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="view-live-flow-btn"
              onClick={onNavigateToFlow}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition shadow-md flex items-center gap-2"
            >
              <Waves className="w-3.5 h-3.5" />
              Explore River Flows
            </button>
            <button
              id="view-temp-btn"
              onClick={onNavigateToTemp}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center gap-2"
            >
              <Thermometer className="w-3.5 h-3.5 text-sky-400" />
              Temperature & Wetsuits
            </button>
          </div>
        </div>
      </div>

      {/* 4 Essential Metrics Cards Grid (Professional Polish clean white cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Flow (CFS) */}
        <div
          onClick={onNavigateToFlow}
          className="group cursor-pointer bg-white border border-slate-200 hover:border-sky-400 rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Waves className="w-4 h-4 text-sky-500" />
                Flow Rate
              </span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform text-[11px] font-semibold">
                Graph &rarr;
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">
                {unit === "metric" ? ((current.flowCfs ?? 0) * 0.0283168).toFixed(1) : (current.flowCfs ?? 0)}
              </span>
              <span className="text-sm font-normal text-slate-500">
                {unit === "metric" ? "m³/s" : "cfs"}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold ${
                    isRising ? "text-emerald-600" : isFalling ? "text-amber-600" : "text-slate-500"
                  }`}
                >
                  {flowDiff > 0 ? `+${flowDiff}` : flowDiff} CFS (24h)
                </span>
              </div>
              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    isRising ? "bg-emerald-500 w-full" : isFalling ? "bg-amber-500 w-3/4" : "bg-sky-500 w-1/2"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Optimal Window</span>
            <span className="text-slate-800 font-medium">650 – 1,100 CFS</span>
          </div>
        </div>

        {/* Card 2: Water Temperature */}
        <div
          onClick={onNavigateToTemp}
          title="Water temperature recorded at BENO gauge (~10 miles south/upstream of park)"
          className="group cursor-pointer bg-white border border-slate-200 hover:border-sky-400 rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Thermometer className="w-4 h-4 text-sky-600" />
                Water Temp
                <span className="text-[10px] font-mono lowercase tracking-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                  beno
                </span>
              </span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform text-[11px] font-semibold">
                Guide &rarr;
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-light text-sky-600 tracking-tight">
                {unit === "metric" ? `${current.waterTempC ?? 0}` : `${(current.waterTempF ?? 0).toFixed(1)}`}
              </span>
              <span className="text-sm font-normal text-slate-500">
                {unit === "metric" ? "°C" : "°F"}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded truncate max-w-[130px]">
                {current.wetsuitRec?.thickness || "3/2mm or 4/3mm"}
              </span>
              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 w-3/4" />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Thermal Comfort</span>
            <span className="text-emerald-600 font-semibold">{current.wetsuitRec?.comfortLevel || "Moderate"}</span>
          </div>
        </div>

        {/* Card 3: Air & Atmosphere */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Wind className="w-4 h-4 text-slate-600" />
                Air & Weather
              </span>
              <span className="text-slate-400 text-[10px]">Bend, OR</span>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-light text-slate-800 tracking-tight">
                {unit === "metric" ? `${((((current.airTempF ?? 0) - 32) * 5) / 9).toFixed(1)}` : `${(current.airTempF ?? 0).toFixed(0)}`}
              </span>
              <span className="text-sm font-normal text-slate-500">
                {unit === "metric" ? "°C" : "°F"}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-500" />
                {data.weather?.current?.wind_speed_10m !== undefined
                  ? `${data.weather.current.wind_speed_10m} mph wind`
                  : "Calm"}
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                UV: {data.weather?.current?.uv_index !== undefined ? data.weather.current.uv_index : "Moderate"}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Dawn Patrol</span>
            <span className="text-slate-800 font-medium">
              Sunrise: {data.weather?.daily?.sunrise?.[0]?.split("T")?.[1] || "06:25 AM"}
            </span>
          </div>
        </div>

        {/* Card 4: Local Air Quality (AQI) Indicator */}
        <div
          onClick={onNavigateToTemp}
          className="group cursor-pointer bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Activity className="w-4 h-4 text-amber-500" />
                Air Quality (AQI)
              </span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform text-[11px] font-semibold">
                Details &rarr;
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl sm:text-4xl font-light tracking-tight ${
                  airQuality.aqi <= 50
                    ? "text-emerald-600 font-normal"
                    : airQuality.aqi <= 100
                    ? "text-amber-600 font-normal"
                    : airQuality.aqi <= 150
                    ? "text-orange-600 font-normal"
                    : airQuality.aqi <= 200
                    ? "text-rose-600 font-normal"
                    : airQuality.aqi <= 300
                    ? "text-purple-600 font-normal"
                    : "text-rose-900 font-normal"
                }`}>
                  {airQuality.aqi}
                </span>
                <span className="text-xs font-semibold text-slate-400 font-mono">
                  AQI
                </span>
              </div>

              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                airQuality.aqi <= 50
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : airQuality.aqi <= 100
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : airQuality.aqi <= 150
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : airQuality.aqi <= 200
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : airQuality.aqi <= 300
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-rose-900 text-white border-rose-950"
              }`}>
                {airQuality.rating}
              </span>
            </div>

            {/* AQI Spectrum Multi-segment Bar */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-mono">
                <span>0</span>
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
                <span>300+</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
                <div className="w-[16.6%] bg-emerald-500 border-r border-white/60" title="0-50: Fresh AF (Good)" />
                <div className="w-[16.6%] bg-amber-400 border-r border-white/60" title="51-100: Moderate" />
                <div className="w-[16.6%] bg-orange-400 border-r border-white/60" title="101-150: Sensitive Groups" />
                <div className="w-[16.6%] bg-rose-500 border-r border-white/60" title="151-200: Unhealthy" />
                <div className="w-[16.6%] bg-purple-600 border-r border-white/60" title="201-300: Very Unhealthy" />
                <div className="w-[17%] bg-rose-900" title="301+: Hazardous" />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="truncate max-w-[130px] text-slate-600 font-medium">PM2.5: {airQuality.pm2_5} µg/m³</span>
            <span className="text-slate-500 font-mono text-[10px] truncate max-w-[140px] text-right" title={airQuality.source || "PurpleAir Colorado Ave"}>
              {airQuality.sensorName || "PurpleAir"} ({airQuality.distance ? airQuality.distance.replace(" from Surf Wave", "") : "0.17 mi"})
            </span>
          </div>
        </div>
      </div>

      {/* Surf Wave Scale & Guide Bar (Professional Polish white container) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Surf Wave Flow Thresholds
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Live reading: {current.flowCfs} CFS
          </span>
        </div>

        {/* Visual Progress / Spectrum */}
        {(() => {
          const minScale = 300;
          const threshMin = current.thresholds?.skimShortFins || 550;
          const threshSurf = current.thresholds?.surfTime || 650;
          const threshFiring = current.thresholds?.awesome || 800;
          const maxScale = Math.max(1100, Math.ceil((current.flowCfs + 50) / 50) * 50);
          const totalSpan = maxScale - minScale;

          const belowMinPct = ((threshMin - minScale) / totalSpan) * 100;
          const lowSurfPct = ((threshSurf - threshMin) / totalSpan) * 100;
          const surfingPct = ((threshFiring - threshSurf) / totalSpan) * 100;
          const firingPct = Math.max(0, 100 - (belowMinPct + lowSurfPct + surfingPct));

          const needlePct = Math.min(99.2, Math.max(0.8, ((current.flowCfs - minScale) / totalSpan) * 100));

          return (
            <div className="relative pt-6 pb-1">
              {/* Track background with color bands mathematically matched to wave thresholds */}
              <div className="h-3.5 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner border border-slate-200/60">
                <div
                  style={{ width: `${belowMinPct}%` }}
                  className="bg-rose-500 border-r border-white/90 transition-all duration-300"
                  title={`${minScale}–${threshMin} CFS: Below Minimum`}
                />
                <div
                  style={{ width: `${lowSurfPct}%` }}
                  className="bg-amber-400 border-r border-white/90 transition-all duration-300"
                  title={`${threshMin}–${threshSurf} CFS: Low-Surfable`}
                />
                <div
                  style={{ width: `${surfingPct}%` }}
                  className="bg-sky-500 border-r border-white/90 transition-all duration-300"
                  title={`${threshSurf}–${threshFiring} CFS: Surfing`}
                />
                <div
                  style={{ width: `${firingPct}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`${threshFiring}+ CFS: Firing`}
                />
              </div>

              {/* Current flow needle marker */}
              <div
                className="absolute top-0 flex flex-col items-center -translate-x-1/2 transition-all duration-500 pointer-events-none z-10"
                style={{ left: `${needlePct}%` }}
              >
                <span className="text-[10px] font-bold font-mono bg-slate-900 text-white px-2 py-0.5 rounded shadow-md border border-slate-700 whitespace-nowrap">
                  {current.flowCfs} CFS ({current.statusLabel})
                </span>
                <div className="w-0.5 h-6 bg-slate-900 mt-1" />
              </div>

              {/* Threshold tick labels beneath the bar */}
              <div className="relative w-full h-4 mt-1.5 text-[10px] font-mono text-slate-400 select-none">
                <span className="absolute left-0">300</span>
                <span
                  className="absolute -translate-x-1/2 text-rose-600 font-semibold"
                  style={{ left: `${belowMinPct}%` }}
                  title="Below Minimum (< 550 CFS)"
                >
                  550
                </span>
                <span
                  className="absolute -translate-x-1/2 text-amber-600 font-semibold"
                  style={{ left: `${belowMinPct + lowSurfPct}%` }}
                  title="Surfing threshold (650 CFS)"
                >
                  650
                </span>
                <span
                  className="absolute -translate-x-1/2 text-emerald-600 font-semibold"
                  style={{ left: `${belowMinPct + lowSurfPct + surfingPct}%` }}
                  title="Firing threshold (800+ CFS)"
                >
                  800+
                </span>
                <span className="absolute right-0 text-slate-400">
                  {maxScale}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Legend grid with active zone highlighting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className={`p-3.5 rounded-lg border transition-all ${
            current.flowCfs < 550
              ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center justify-between font-bold text-rose-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                &lt; 550 CFS
              </span>
              {current.flowCfs < 550 && (
                <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-slate-900 font-bold text-sm mt-1">Below Minimum</p>
            <p className="text-slate-600 text-[11px] mt-1 leading-snug">
              Wait for more water, contact with rocks and concrete is a certainty.
            </p>
          </div>

          <div className={`p-3.5 rounded-lg border transition-all ${
            current.flowCfs >= 550 && current.flowCfs < 650
              ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center justify-between font-bold text-amber-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                550 – 650 CFS
              </span>
              {current.flowCfs >= 550 && current.flowCfs < 650 && (
                <span className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-slate-900 font-bold text-sm mt-1">Low-Surfable</p>
            <p className="text-slate-600 text-[11px] mt-1 leading-snug">
              Bring your foamy, skimboard, and short fins, ramp is shallow so helmets are recommended.
            </p>
          </div>

          <div className={`p-3.5 rounded-lg border transition-all ${
            current.flowCfs >= 650 && current.flowCfs < 800
              ? "bg-sky-50 border-sky-300 ring-2 ring-sky-400/30"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center justify-between font-bold text-sky-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                650 – 800 CFS
              </span>
              {current.flowCfs >= 650 && current.flowCfs < 800 && (
                <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-slate-900 font-bold text-sm mt-1">Surfing</p>
            <p className="text-slate-600 text-[11px] mt-1 leading-snug">
              Wave is in great shape and surfing well, contact with concrete and rocks unlikely.
            </p>
          </div>

          <div className={`p-3.5 rounded-lg border transition-all ${
            current.flowCfs >= 800
              ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30"
              : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center justify-between font-bold text-emerald-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                800+ CFS
              </span>
              {current.flowCfs >= 800 && (
                <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-emerald-950 font-bold text-sm mt-1">Firing</p>
            <p className="text-emerald-800 text-[11px] mt-1 leading-snug">
              Wave is steep and fast, bring your full performance river surf quiver.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
