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
import { Waves, Calendar, Download, Eye, TrendingUp, Maximize2 } from "lucide-react";
import { SurfDataResponse, TimeRange, UnitType } from "../types";
import { formatHydroDateTime } from "../utils/dateUtils";

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

    // Format timestamps for display
    return sliced.map((item) => {
      const { shortDate, shortTime, shortLabel, displayTime, displayDate } = formatHydroDateTime(
        item.date,
        timeRange
      );

      const val = typeof item.cfs === "number" && !isNaN(item.cfs) ? item.cfs : 0;
      return {
        ...item,
        cfs: val,
        shortDate,
        shortTime,
        shortLabel,
        displayTime,
        displayDate: displayDate || shortDate,
        flowMetric: parseFloat((val * 0.0283168).toFixed(2)),
      };
    });
  }, [data.timeSeries.flow, timeRange]);

  // Compute statistical metrics for the selected range
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { min: 0, max: 0, avg: 0, current: 0 };
    const values = filteredData.map((d) => d.cfs || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? Math.round(sum / values.length) : 0;
    const current = values[values.length - 1] ?? 0;
    return { min, max, avg, current };
  }, [filteredData]);

  // Export current view data as CSV
  const handleExportCSV = () => {
    const headers = "Date,CFS,M3_per_sec,Status\n";
    const rows = filteredData
      .map((d) => {
        const status =
          d.cfs >= 800
            ? "FIRING"
            : d.cfs >= 650
            ? "SURFING"
            : d.cfs >= 550
            ? "LOW-SURFABLE"
            : "BELOW MINIMUM";
        return `"${d.date}",${d.cfs},${(d.cfs * 0.0283).toFixed(2)},"${status}"`;
      })
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bend_Surf_Wave_Flow_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const cfs = point.cfs;
      let status = "Firing";
      let statusBadge = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      if (cfs < 550) {
        status = "Below Minimum";
        statusBadge = "bg-rose-500/20 text-rose-300 border-rose-500/40";
      } else if (cfs < 650) {
        status = "Low-Surfable";
        statusBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      } else if (cfs < 800) {
        status = "Surfing";
        statusBadge = "bg-sky-500/20 text-sky-300 border-sky-500/40";
      }

      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[200px]">
          <div className="text-slate-400 font-medium border-b border-slate-800 pb-1 flex justify-between">
            <span>{point.displayDate || point.shortDate}</span>
            <span className="font-mono text-slate-500">Bend Whitewater</span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-slate-300 font-medium">River Discharge:</span>
            <span className="text-lg font-bold text-white font-mono">
              {unit === "metric" ? `${point.flowMetric} m³/s` : `${cfs} CFS`}
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

  return (
    <div className="space-y-6">
      {/* Chart Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        {/* Graph Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Bend Surf Wave Cubic Feet Per Second (CFS)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Instantaneous discharge at Head of Park, Deschutes River (Bend, Oregon)
            </p>
          </div>

          {/* Time Range Filter Buttons & CSV Export */}
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

            <button
              id="export-flow-csv-btn"
              onClick={handleExportCSV}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
              title="Download raw flow CSV data"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Current Flow</span>
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
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="shortLabel"
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={{ stroke: "#cbd5e1" }}
                interval="preserveStartEnd"
                minTickGap={40}
              />

              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={{ stroke: "#cbd5e1" }}
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
                    stroke="#059669"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "22.7 m³/s (Firing)" : "800 CFS (Firing)",
                      fill: "#059669",
                      fontSize: 11,
                      position: "insideTopRight",
                      fontWeight: 600,
                    }}
                  />
                  <ReferenceLine
                    y={unit === "metric" ? parseFloat((650 * 0.0283168).toFixed(1)) : 650}
                    stroke="#0284c7"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "18.4 m³/s (Surfing)" : "650 CFS (Surfing)",
                      fill: "#0284c7",
                      fontSize: 11,
                      position: "insideTopRight",
                      fontWeight: 600,
                    }}
                  />
                  <ReferenceLine
                    y={unit === "metric" ? parseFloat((550 * 0.0283168).toFixed(1)) : 550}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: unit === "metric" ? "15.6 m³/s (Low-Surfable)" : "550 CFS (Low-Surfable)",
                      fill: "#d97706",
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
                stroke="#0284c7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#flowGradient)"
                activeDot={{ r: 5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Guide under graph */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-600 rounded-full" /> Head of Park CFS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-600 border-dashed" /> 800+ Firing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-600 border-dashed" /> 650–800 Surfing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-600 border-dashed" /> 550–650 Low-Surfable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
