import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Activity, Calendar, Sparkles, Filter, Check, Eye, Waves } from "lucide-react";
import { SurfDataResponse, UnitType } from "../types";

interface HistoricalGraphProps {
  data: SurfDataResponse;
  unit: UnitType;
}

const YEAR_COLORS: Record<string, string> = {
  "2024": "#10b981", // Emerald
  "2023": "#06b6d4", // Cyan
  "2022": "#3b82f6", // Blue
  "2021": "#8b5cf6", // Purple
  "2020": "#ec4899", // Pink
  "2019": "#f59e0b", // Amber
  "2018": "#ef4444", // Red
  "2017": "#14b8a6", // Teal
  "2016": "#84cc16", // Lime
  "2015": "#a855f7", // Violet
  "2014": "#eab308", // Yellow
  "2013": "#64748b", // Slate
};

export const HistoricalGraph: React.FC<HistoricalGraphProps> = ({ data, unit }) => {
  const years = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013"];
  
  // Surf wave threshold reference lines toggle (on by default)
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  // Default show recent 4 years to avoid clutter
  const [selectedYears, setSelectedYears] = useState<{ [key: string]: boolean }>({
    "2024": true,
    "2023": true,
    "2022": true,
    "2021": true,
    "2020": false,
    "2019": false,
    "2018": false,
    "2017": false,
    "2016": false,
    "2015": false,
    "2014": false,
    "2013": false,
  });

  const toggleYear = (y: string) => {
    setSelectedYears((prev) => ({ ...prev, [y]: !prev[y] }));
  };

  const selectAllYears = () => {
    const updated: Record<string, boolean> = {};
    years.forEach((y) => (updated[y] = true));
    setSelectedYears(updated);
  };

  const selectRecentOnly = () => {
    const updated: Record<string, boolean> = {};
    years.forEach((y, i) => (updated[y] = i < 3));
    setSelectedYears(updated);
  };

  // Format data
  const formattedData = useMemo(() => {
    const raw = data.timeSeries.historical;
    if (!raw || raw.length === 0) return [];

    return raw.map((row) => {
      const dateStr = row.date || "";
      // e.g. "2019-05-14 1:00" -> extract "May 14"
      const parts = dateStr.split(" ")[0]?.split("-");
      const monthNum = parts ? parseInt(parts[1], 10) : 1;
      const dayNum = parts ? parseInt(parts[2], 10) : 1;

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const shortLabel = `${monthNames[monthNum - 1] || "Jan"} ${dayNum || 1}`;

      const point: Record<string, any> = {
        date: dateStr,
        shortLabel,
      };

      years.forEach((y) => {
        const val = row[y];
        if (val !== undefined && val !== null && !isNaN(val)) {
          point[y] = unit === "metric" ? parseFloat((val * 0.0283168).toFixed(1)) : val;
        }
      });

      return point;
    });
  }, [data.timeSeries.historical, unit]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[220px]">
          <div className="text-slate-400 font-medium border-b border-slate-800 pb-1 flex justify-between">
            <span>Calendar Day: {point.shortLabel}</span>
            <span className="font-mono text-emerald-400">Head of Park</span>
          </div>

          <div className="space-y-1 pt-1">
            {payload.map((item: any) => (
              <div key={item.dataKey} className="flex justify-between items-center">
                <span style={{ color: item.color }} className="font-semibold">
                  {item.name}:
                </span>
                <span className="font-mono text-white font-bold">
                  {item.value} {unit === "metric" ? "m³/s" : "CFS"}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Historical Water Flows at Head of Park (2013 – 2024)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              12-Year comparative hydrographs for Deschutes River flow patterns and peak runoff windows
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="toggle-historical-thresholds-btn"
              onClick={() => setShowThresholds(!showThresholds)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                showThresholds
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
              title="Toggle surf wave flow threshold reference lines"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Surf Thresholds</span>
            </button>
            <button
              onClick={selectRecentOnly}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
            >
              Recent 3 Years
            </button>
            <button
              onClick={selectAllYears}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
            >
              All Years (2013-2024)
            </button>
          </div>
        </div>

        {/* Year toggle pills */}
        <div className="flex flex-wrap gap-1.5 my-4">
          {years.map((year) => {
            const isSelected = !!selectedYears[year];
            const color = YEAR_COLORS[year] || "#059669";
            return (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`px-3 py-1 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-50 border-slate-300 text-slate-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isSelected ? color : "#cbd5e1" }}
                />
                {year}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div className="h-80 sm:h-96 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                      return Math.min(12, Math.floor((dataMin || 12) - 1));
                    }
                    return Math.min(450, Math.floor(((dataMin || 450) - 50) / 50) * 50);
                  },
                  (dataMax: number) => {
                    if (unit === "metric") {
                      return Math.max(28, Math.ceil((dataMax || 28) + 1));
                    }
                    return Math.max(950, Math.ceil(((dataMax || 950) + 50) / 50) * 50);
                  },
                ]}
                unit={unit === "metric" ? " m³" : " cfs"}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Surf Wave Flow Threshold Reference Lines */}
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

              {years.map((year) => {
                if (!selectedYears[year]) return null;
                const isHighlight = year === "2024" || year === "2023";
                return (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={year}
                    name={`${year} Season`}
                    stroke={YEAR_COLORS[year] || "#059669"}
                    strokeWidth={isHighlight ? 3 : 1.5}
                    dot={false}
                    opacity={isHighlight ? 1 : 0.75}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Surf Wave Flow Threshold Legend & Reference Guide */}
        {showThresholds && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-sky-600" />
                Surf Wave Thresholds:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600 rounded"></span>
                <span className="text-emerald-700 font-semibold font-mono text-[11px]">
                  &ge; {unit === "metric" ? "22.7 m³/s" : "800 CFS"} (Firing)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-600 rounded"></span>
                <span className="text-sky-700 font-semibold font-mono text-[11px]">
                  {unit === "metric" ? "18.4–22.7 m³/s" : "650–800 CFS"} (Surfing)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-600 rounded"></span>
                <span className="text-amber-700 font-semibold font-mono text-[11px]">
                  {unit === "metric" ? "15.6–18.4 m³/s" : "550–650 CFS"} (Low-Surfable)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-400 rounded"></span>
                <span className="text-rose-600 font-medium font-mono text-[11px]">
                  &lt; {unit === "metric" ? "15.6 m³/s" : "550 CFS"} (Below Minimum)
                </span>
              </div>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">Bend Whitewater Park Calibration</span>
          </div>
        )}

        <div className={`mt-3 ${showThresholds ? "pt-2" : "pt-3 border-t border-slate-100"} flex items-center justify-between text-xs text-slate-500`}>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Peak surf flows typically occur May through August during agricultural irrigation releases.
          </span>
        </div>
      </div>
    </div>
  );
};
