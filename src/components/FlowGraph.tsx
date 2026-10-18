import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { Waves, Calendar, Eye, TrendingUp, Maximize2 } from "lucide-react";
import { SurfDataResponse, TimeRange, UnitType } from "../types";
import { GageUnavailable, UnavailableCard } from "./GageUnavailable";
import { formatHydroDateTime } from "../utils/dateUtils";
import { FlowMethodInfo } from "./FlowMethodInfo";

interface FlowGraphProps {
  data: SurfDataResponse;
  unit: UnitType;
}

export const FlowGraph: React.FC<FlowGraphProps> = ({ data, unit }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [showThresholds, setShowThresholds] = useState(true);

  // Filter time series based on selected range
  const filteredData = useMemo(() => {
    const raw = data.timeSeries.flow;
    if (!raw || raw.length === 0) return [];

    let sliced = raw;
    if (timeRange === "7d") {
      sliced = raw.slice(-Math.min(raw.length, 96 * 7));
    } else if (timeRange === "30d") {
      if (raw.length > 0) {
        const lastDate = new Date(raw[raw.length - 1].date.replace(/-/g, "/"));
        if (!isNaN(lastDate.getTime())) {
          const cutoff = new Date(lastDate);
          cutoff.setDate(cutoff.getDate() - 30);
          sliced = raw.filter((item) => {
            const d = new Date(item.date.replace(/-/g, "/"));
            return !isNaN(d.getTime()) && d >= cutoff;
          });
        } else {
          sliced = raw.slice(-Math.min(raw.length, 96 * 30));
        }
      }
    } else {
      // Full Year: return entire time series (past 365 days)
      sliced = raw;
    }

    // Append the modeled outlook (flow already between Benham Falls and the park).
    // The last observed point also carries forecastCfs so the dashed line connects.
    const forecast = data.timeSeries.flowForecast ?? [];
    const lastObs = sliced[sliced.length - 1];
    const combined: Array<(typeof sliced)[number] & { forecastCfs?: number; isForecast?: boolean }> = [
      ...sliced.slice(0, -1),
      ...(lastObs ? [{ ...lastObs, forecastCfs: forecast.length ? lastObs.cfs : undefined }] : []),
      ...forecast.map((f) => ({ ...f, forecastCfs: f.cfs, isForecast: true })),
    ];

    // Format timestamps for display
    return combined.map((item) => {
      const { shortDate, shortTime, shortLabel, displayTime, displayDate } = formatHydroDateTime(
        item.date,
        timeRange
      );

      const val = typeof item.cfs === "number" && !isNaN(item.cfs) ? item.cfs : 0;
      const fc = item.forecastCfs;
      return {
        ...item,
        cfs: item.isForecast ? undefined : val,
        forecastMetric: typeof fc === "number" ? parseFloat((fc * 0.0283168).toFixed(2)) : undefined,
        shortDate,
        shortTime,
        shortLabel,
        displayTime,
        displayDate: displayDate || shortDate,
        flowMetric: item.isForecast ? undefined : parseFloat((val * 0.0283168).toFixed(2)),
      };
    });
  }, [data.timeSeries.flow, data.timeSeries.flowForecast, timeRange]);

  // Compute statistical metrics for the selected range
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { min: 0, max: 0, avg: 0, current: 0 };
    const values = filteredData.filter((d) => !d.isForecast).map((d) => d.cfs || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? Math.round(sum / values.length) : 0;
    const current = values[values.length - 1] ?? 0;
    return { min, max, avg, current };
  }, [filteredData]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const cfs = point.isForecast ? point.forecastCfs : point.cfs;
      let status = "Firing";
      let statusBadge = "bg-firing-500/30 text-firing-200 border-firing-400/50";
      if (cfs < 550) {
        status = "Below Recommended";
        statusBadge = "bg-belowrec-500/25 text-belowrec-200 border-belowrec-400/40";
      } else if (cfs < 650) {
        status = "Low-Surfable";
        statusBadge = "bg-lowsurf-500/20 text-lowsurf-200 border-lowsurf-400/40";
      } else if (cfs < 800) {
        status = "Optimal";
        statusBadge = "bg-optimal-500/25 text-optimal-200 border-optimal-400/40";
      }

      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[200px]">
          <div className="text-slate-400 font-medium border-b border-slate-800 pb-1 flex justify-between">
            <span>{point.displayDate || point.shortDate}</span>
            <span className="font-mono text-slate-500">Bend Whitewater</span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-slate-300 font-medium">{point.isForecast ? "Modeled outlook:" : "River Discharge:"}</span>
            <span className="text-lg font-bold text-white font-mono">
              {unit === "metric" ? `${point.isForecast ? point.forecastMetric : point.flowMetric} m³/s` : `${cfs} CFS`}
            </span>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <span className="text-slate-400">Wave Condition:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${statusBadge}`}>
              {status}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const flowStatus = data.dataStatus?.flow;
  if (data.timeSeries.flow.length === 0) {
    return <UnavailableCard title="Bend Surf Wave Current Flow (CFS)" status={flowStatus} what="Flow data" />;
  }

  return (
    <div className="space-y-6">
      {flowStatus && !flowStatus.available && (
        <GageUnavailable status={flowStatus} what="Current flow" />
      )}
      {/* Chart Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        {/* Graph Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Bend Surf Wave Current Flow (CFS)
              </h3>
              <FlowMethodInfo data={data} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Head of Park flow modeled from USBR Hydromet gages: Benham Falls (lagged for travel time) minus canal diversions
            </p>
          </div>

          {/* Time Range Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
              {(["7d", "30d", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  id={`range-flow-${r}`}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    timeRange === r
                      ? "bg-white text-sky-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "Full Year"}
                </button>
              ))}
            </div>

            <button
              id="toggle-thresholds-btn"
              onClick={() => setShowThresholds(!showThresholds)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                showThresholds
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
              title="Toggle surf threshold lines"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thresholds</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">{flowStatus && !flowStatus.available ? "Last Reading" : "Current Flow"}</span>
            <span className="text-base sm:text-lg font-light text-slate-900 font-mono">
              {unit === "metric" ? `${((stats.current ?? 0) * 0.0283).toFixed(1)} m³/s` : `${stats.current ?? 0} CFS`}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Period Average</span>
            <span className="text-base sm:text-lg font-light text-sky-600 font-mono">
              {unit === "metric" ? `${((stats.avg ?? 0) * 0.0283).toFixed(1)} m³/s` : `${stats.avg ?? 0} CFS`}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Period High</span>
            <span className="text-base sm:text-lg font-light text-emerald-600 font-mono">
              {unit === "metric" ? `${((stats.max ?? 0) * 0.0283).toFixed(1)} m³/s` : `${stats.max ?? 0} CFS`}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Period Low</span>
            <span className="text-base sm:text-lg font-light text-amber-600 font-mono">
              {unit === "metric" ? `${((stats.min ?? 0) * 0.0283).toFixed(1)} m³/s` : `${stats.min ?? 0} CFS`}
            </span>
          </div>
        </div>

        {/* Recharts Area Flow Chart */}
        <div className="h-80 sm:h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a6785" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4a6785" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f4ede0" vertical={false} />

              <XAxis
                dataKey="shortLabel"
                stroke="#a29f99"
                tick={{ fontSize: 11, fill: "#6c7080" }}
                tickLine={{ stroke: "#d1c8b5" }}
                interval="preserveStartEnd"
                minTickGap={40}
              />

              <YAxis
                stroke="#a29f99"
                tick={{ fontSize: 11, fill: "#6c7080" }}
                tickLine={{ stroke: "#d1c8b5" }}
                domain={[
                  (dataMin: number) => {
                    if (unit === "metric") {
                      return Math.min(14, Math.floor((dataMin || 14) - 1));
                    }
                    return Math.min(500, Math.floor(((dataMin || 500) - 20) / 50) * 50);
                  },
                  (dataMax: number) => {
                    if (unit === "metric") {
                      return Math.max(26, Math.ceil((dataMax || 26) + 1));
                    }
                    return Math.max(900, Math.ceil(((dataMax || 900) + 40) / 50) * 50);
                  },
                ]}
                unit={unit === "metric" ? " m³" : " cfs"}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Threshold Lines */}
              {showThresholds && (
                <>
                  <ReferenceLine
                    y={unit === "metric" ? parseFloat((800 * 0.0283168).toFixed(1)) : 800}
                    stroke="#1d5492"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "22.7 m³/s (Firing)" : "800 CFS (Firing)",
                      fill: "#1d5492",
                      fontSize: 11,
                      position: "insideTopRight",
                      fontWeight: 600,
                    }}
                  />
                  <ReferenceLine
                    y={unit === "metric" ? parseFloat((650 * 0.0283168).toFixed(1)) : 650}
                    stroke="#347d4c"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "18.4 m³/s (Optimal)" : "650 CFS (Optimal)",
                      fill: "#347d4c",
                      fontSize: 11,
                      position: "insideTopRight",
                      fontWeight: 600,
                    }}
                  />
                  <ReferenceLine
                    y={unit === "metric" ? parseFloat((550 * 0.0283168).toFixed(1)) : 550}
                    stroke="#c18f24"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "15.6 m³/s (Low-Surfable)" : "550 CFS (Low-Surfable)",
                      fill: "#c18f24",
                      fontSize: 11,
                      position: "insideTopRight",
                      fontWeight: 600,
                    }}
                  />
                </>
              )}

              <Area
                type="monotone"
                dataKey={unit === "metric" ? "flowMetric" : "cfs"}
                stroke="#4a6785"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#flowGradient)"
                activeDot={{ r: 5, fill: "#4a6785", stroke: "#ffffff", strokeWidth: 2 }}
              />

              {/* Modeled outlook: flow already between Benham Falls and the park */}
              <Area
                type="monotone"
                dataKey={unit === "metric" ? "forecastMetric" : "forecastCfs"}
                stroke="#4a6785"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="none"
                connectNulls={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: "#ffffff", stroke: "#4a6785", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Guide under graph */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-600 rounded-full" /> Head of Park CFS (modeled)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0 border-t-2 border-dashed border-sky-600" /> Outlook (already past Benham Falls)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-firing-600 border-dashed" /> 800+ Firing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-optimal-600 border-dashed" /> 650–800 Optimal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-lowsurf-600 border-dashed" /> 550–650 Low-Surfable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
