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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Droplet,
  TrendingDown,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { SurfDataResponse, UnitType } from "../types";

interface WickiupReservoirGraphProps {
  data: SurfDataResponse;
  unit: UnitType;
}

type TimeWindow = "1y" | "6m" | "90d";
type ScaleMode = "dynamic" | "full";

function formatWickiupDateTime(raw?: string): string {
  if (!raw) return "Sep 14, 8:15 AM";
  try {
    const cleaned = raw.trim().replace(/\//g, "-");
    const parts = cleaned.split(/[\sT]+/);
    let year = 0,
      month = 0,
      day = 0,
      hour = 0,
      min = 0;
    if (parts[0]) {
      const dateParts = parts[0].split("-").map(Number);
      if (dateParts[0] > 1000) {
        year = dateParts[0];
        month = dateParts[1] - 1;
        day = dateParts[2];
      } else if (dateParts[2] > 1000) {
        month = dateParts[0] - 1;
        day = dateParts[1];
        year = dateParts[2];
      }
    }
    if (parts[1]) {
      const timeParts = parts[1].split(":").map(Number);
      hour = timeParts[0] || 0;
      min = timeParts[1] || 0;
    }
    if (year > 0) {
      const d = new Date(year, month, day, hour, min);
      const monthStr = d.toLocaleString("en-US", { month: "short" });
      const dayNum = d.getDate();
      let hourNum = d.getHours();
      const ampm = hourNum >= 12 ? "PM" : "AM";
      hourNum = hourNum % 12 || 12;
      const minStr = d.getMinutes().toString().padStart(2, "0");
      if (parts[1]) {
        return `${monthStr} ${dayNum}, ${hourNum}:${minStr} ${ampm}`;
      } else {
        return `${monthStr} ${dayNum}`;
      }
    }
    const fallbackD = new Date(raw);
    if (!isNaN(fallbackD.getTime())) {
      return fallbackD.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {
    // fallback
  }
  return raw;
}

export const WickiupReservoirGraph: React.FC<WickiupReservoirGraphProps> = ({
  data,
  unit,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("1y");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("full");

  const storageData = data.wickiupStorage;
  const rawHistory = storageData?.history || [];

  // Fallback defaults if storageData is still populating
  const capacityAf = storageData?.capacityAcreFeet || 200000;
  const currentAf = storageData?.currentAcreFeet ?? 35575;
  const currentPct =
    storageData?.percentOfCapacity ??
    parseFloat(((currentAf / capacityAf) * 100).toFixed(1));
  const lastUpdated = storageData?.lastUpdated || data.lastUpdated;
  const formattedLastUpdated = formatWickiupDateTime(lastUpdated);

  // Filter and format daily history based on selected time window
  const filteredHistory = useMemo(() => {
    if (!rawHistory || rawHistory.length === 0) {
      const simulatedPoints = [];
      const now = Date.now();
      const days = timeWindow === "90d" ? 90 : timeWindow === "6m" ? 180 : 365;

      for (let i = days; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const dayOfYear = Math.floor(
          (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000
        );
        const sinFactor = Math.sin(((dayOfYear - 15) / 365) * 2 * Math.PI);
        const af = Math.round(75000 + 45000 * sinFactor);
        const isoDate = d.toISOString().slice(0, 10);
        const [y, m, dayNum] = isoDate.split("-").map(Number);
        const dateObj = new Date(y, m - 1, dayNum);

        simulatedPoints.push({
          date: isoDate,
          timestamp: d.getTime(),
          acreFeet: af,
          percent: parseFloat(((af / capacityAf) * 100).toFixed(1)),
          displayLabel:
            timeWindow === "1y"
              ? `${dateObj.toLocaleString("en-US", { month: "short" })} '${String(y).slice(-2)}`
              : dateObj.toLocaleString("en-US", { month: "short", day: "numeric" }),
          fullDate: dateObj.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        });
      }
      return simulatedPoints;
    }

    let sliceCount = rawHistory.length;
    if (timeWindow === "90d") sliceCount = Math.min(rawHistory.length, 90);
    else if (timeWindow === "6m") sliceCount = Math.min(rawHistory.length, 180);
    else sliceCount = rawHistory.length;

    const sliced = rawHistory.slice(-sliceCount);

    return sliced.map((item) => {
      const parts = item.date.split(/[\sT]+/)[0].split("-").map(Number);
      let dateObj: Date;
      let y = 2026;
      if (parts[0] > 1000) {
        y = parts[0];
        dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        dateObj = new Date(item.timestamp || item.date);
        y = dateObj.getFullYear();
      }

      const displayLabel =
        timeWindow === "1y"
          ? `${dateObj.toLocaleString("en-US", { month: "short" })} '${String(y).slice(-2)}`
          : dateObj.toLocaleString("en-US", { month: "short", day: "numeric" });

      const fullDate = dateObj.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return {
        ...item,
        displayLabel,
        fullDate,
      };
    });
  }, [rawHistory, timeWindow, capacityAf]);

  // Calculate 7-day and 30-day storage changes from daily history
  const { change7dAf, change7dPct, change30dAf, change30dPct } = useMemo(() => {
    if (!rawHistory || rawHistory.length === 0) {
      return {
        change7dAf: -3980,
        change7dPct: -2.0,
        change30dAf: -19866,
        change30dPct: -9.9,
      };
    }

    const latest = rawHistory[rawHistory.length - 1];
    const latestAf = latest?.acreFeet ?? currentAf;

    // Find closest point ~7 days ago
    const target7dTs = (latest?.timestamp || Date.now()) - 7 * 86400000;
    let point7d = rawHistory[Math.max(0, rawHistory.length - 1 - 7)];
    for (let i = rawHistory.length - 1; i >= 0; i--) {
      if (rawHistory[i].timestamp <= target7dTs) {
        point7d = rawHistory[i];
        break;
      }
    }

    // Find closest point ~30 days ago
    const target30dTs = (latest?.timestamp || Date.now()) - 30 * 86400000;
    let point30d = rawHistory[Math.max(0, rawHistory.length - 1 - 30)];
    for (let i = rawHistory.length - 1; i >= 0; i--) {
      if (rawHistory[i].timestamp <= target30dTs) {
        point30d = rawHistory[i];
        break;
      }
    }

    const diff7d = latestAf - (point7d?.acreFeet ?? latestAf);
    const pct7d = parseFloat(((diff7d / capacityAf) * 100).toFixed(1));

    const diff30d = latestAf - (point30d?.acreFeet ?? latestAf);
    const pct30d = parseFloat(((diff30d / capacityAf) * 100).toFixed(1));

    return {
      change7dAf: diff7d,
      change7dPct: pct7d,
      change30dAf: diff30d,
      change30dPct: pct30d,
    };
  }, [rawHistory, currentAf, capacityAf]);

  // Calculations for unit display
  const formatAf = (af: number) => {
    if (unit === "metric") {
      const millionM3 = (af * 0.00123348).toFixed(2);
      return `${millionM3}M m³`;
    }
    return `${af.toLocaleString()} AF`;
  };

  const formatAfChange = (af: number) => {
    const sign = af > 0 ? "+" : af < 0 ? "-" : "";
    const abs = Math.abs(af);
    if (unit === "metric") {
      const millionM3 = (abs * 0.00123348).toFixed(2);
      return `${sign}${millionM3}M m³`;
    }
    return `${sign}${abs.toLocaleString()} AF`;
  };

  const emptySpaceAf = Math.max(0, capacityAf - currentAf);
  const emptySpacePct = parseFloat((100 - currentPct).toFixed(1));

  // Data for Donut Chart
  const pieData = [
    { name: "Current Storage", value: currentAf, color: "#0284c7" },
    { name: "Available Capacity", value: emptySpaceAf, color: "#e2e8f0" },
  ];

  // Min and max for line graph axis
  const minAf = Math.min(...filteredHistory.map((d) => d.acreFeet));
  const maxAf = Math.max(...filteredHistory.map((d) => d.acreFeet));
  const yDomainMin =
    scaleMode === "full" ? 0 : Math.max(0, Math.floor((minAf - 2000) / 5000) * 5000);
  const yDomainMax =
    scaleMode === "full" ? capacityAf : Math.ceil((maxAf + 2000) / 5000) * 5000;

  // Compute clean adaptive interval for X-axis ticks
  const tickInterval = Math.max(1, Math.floor(filteredHistory.length / 6));

  return (
    <div
      id="wickiup-reservoir-component"
      className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-6"
    >
      {/* Component Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 shrink-0 mt-0.5">
            <Droplet className="w-5 h-5 fill-sky-600/20 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              Wickiup Reservoir Level & Storage
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
              Irrigation releases from Wickiup Dam are the primary determinant of Deschutes River flows and the Bend surf wave level.
            </p>
          </div>
        </div>

        {/* Vibrant Colored Pill for Date and Time */}
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600 text-white text-xs font-semibold shadow-xs self-start sm:self-auto shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-200 animate-pulse"></span>
          <Calendar className="w-3.5 h-3.5 text-sky-100" />
          <span>Updated: {formattedLastUpdated}</span>
        </span>
      </div>

      {/* DONUT CHART GRAPHIC */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
          {/* Donut Visual with Center Percentage */}
          <div className="relative h-44 w-44 shrink-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {currentPct}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Capacity
              </span>
            </div>
          </div>

          {/* Breakdown Legend & Key Quantities */}
          <div className="w-full max-w-sm space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-sky-600 shrink-0"></div>
                <span className="text-slate-600 font-medium">Stored Water</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900">{formatAf(currentAf)}</span>
                <span className="text-slate-400 ml-1.5">({currentPct}%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-200 border border-slate-300 shrink-0"></div>
                <span className="text-slate-600 font-medium">Available Headroom</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-700">{formatAf(emptySpaceAf)}</span>
                <span className="text-slate-400 ml-1.5">({emptySpacePct}%)</span>
              </div>
            </div>

            {/* 7-Day & 30-Day Storage Change Indicators */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {/* 7-Day Change */}
              <div
                className={`p-2.5 rounded-lg border flex flex-col justify-between transition ${
                  change7dAf >= 0
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/80 border-rose-200 text-rose-950"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>7-Day Change</span>
                  {change7dAf >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                </div>
                <div
                  className={`text-sm font-bold tracking-tight ${
                    change7dAf >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatAfChange(change7dAf)}
                </div>
                <div
                  className={`text-[10px] font-semibold mt-0.5 ${
                    change7dAf >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {change7dPct >= 0 ? `+${change7dPct}%` : `${change7dPct}%`}{" "}
                  <span className="font-normal text-slate-500">
                    {change7dAf >= 0 ? "storing" : "released"}
                  </span>
                </div>
              </div>

              {/* 30-Day Change */}
              <div
                className={`p-2.5 rounded-lg border flex flex-col justify-between transition ${
                  change30dAf >= 0
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/80 border-rose-200 text-rose-950"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>30-Day Change</span>
                  {change30dAf >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                </div>
                <div
                  className={`text-sm font-bold tracking-tight ${
                    change30dAf >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatAfChange(change30dAf)}
                </div>
                <div
                  className={`text-[10px] font-semibold mt-0.5 ${
                    change30dAf >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {change30dPct >= 0 ? `+${change30dPct}%` : `${change30dPct}%`}{" "}
                  <span className="font-normal text-slate-500">
                    {change30dAf >= 0 ? "storing" : "released"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2.5 pt-0.5 text-[11px] text-slate-500">
              <span>Total Storage Capacity</span>
              <span className="font-semibold text-slate-700">{formatAf(capacityAf)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* LINE GRAPH SECTION: Wickiup Reservoir Storage */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Wickiup Reservoir Storage
            </h3>
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-400 font-normal pl-2 border-l border-slate-200">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-amber-500 rounded-full"></span>
                <span className="text-amber-700 font-medium">Current Level</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-sky-600 rounded-full"></span>
                <span className="text-sky-700 font-medium">200k Full Pool</span>
              </span>
            </span>
          </div>

          {/* Controls: Time Window & Scale Mode */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
              <button
                onClick={() => setScaleMode("full")}
                className={`px-2.5 py-1 rounded-md transition ${
                  scaleMode === "full"
                    ? "bg-white text-sky-700 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
                title="Show 0 to 200,000 AF full reservoir scale"
              >
                0–200k Full Pool
              </button>
              <button
                onClick={() => setScaleMode("dynamic")}
                className={`px-2.5 py-1 rounded-md transition ${
                  scaleMode === "dynamic"
                    ? "bg-white text-sky-700 shadow-xs font-bold"
                    : "hover:text-slate-900"
                }`}
                title="Zoom axis to fluctuation range"
              >
                Detailed Zoom
              </button>
            </div>

            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
              {[
                { id: "1y", label: "1 Year" },
                { id: "6m", label: "6 Months" },
                { id: "90d", label: "90 Days" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTimeWindow(t.id as TimeWindow)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    timeWindow === t.id
                      ? "bg-white text-sky-700 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recharts Area/Line Chart */}
        <div className="h-[320px] sm:h-[360px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredHistory}
              margin={{ top: 10, right: 15, left: 10, bottom: 20 }}
            >
              <defs>
                <linearGradient id="wickiupStorageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

              <XAxis
                dataKey="displayLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                interval={tickInterval}
                dy={8}
              />

              <YAxis
                yAxisId="afAxis"
                domain={[yDomainMin, yDomainMax]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                tickFormatter={(val) => {
                  if (unit === "metric") {
                    return `${(val * 0.00123348).toFixed(1)}M`;
                  }
                  return `${(val / 1000).toFixed(0)}k AF`;
                }}
                dx={-4}
              />

              <YAxis
                yAxisId="pctAxis"
                orientation="right"
                domain={[
                  parseFloat(((yDomainMin / capacityAf) * 100).toFixed(1)),
                  parseFloat(((yDomainMax / capacityAf) * 100).toFixed(1)),
                ]}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val.toFixed(0)}%`}
                dx={4}
              />

              <Tooltip content={<CustomStorageTooltip unit={unit} capacityAf={capacityAf} />} />

              {scaleMode === "full" && (
                <ReferenceLine
                  yAxisId="afAxis"
                  y={200000}
                  stroke="#0284c7"
                  strokeDasharray="4 4"
                  label={{
                    value: "Full Capacity: 200,000 AF (100%)",
                    position: "insideTopRight",
                    fill: "#0284c7",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )}

              <ReferenceLine
                yAxisId="afAxis"
                y={currentAf}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{
                  value: `Current Level: ${currentAf.toLocaleString()} AF (${currentPct}%)`,
                  position: "insideBottomRight",
                  fill: "#ea580c",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />

              <Area
                yAxisId="afAxis"
                type="monotone"
                dataKey="acreFeet"
                name="Storage (AF)"
                stroke="#0284c7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#wickiupStorageGradient)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip for the Storage Chart
interface CustomStorageTooltipProps {
  active?: boolean;
  payload?: any[];
  unit: UnitType;
  capacityAf: number;
}

const CustomStorageTooltip: React.FC<CustomStorageTooltipProps> = ({
  active,
  payload,
  unit,
  capacityAf,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0].payload;
  const af = dataPoint.acreFeet;
  const pct = dataPoint.percent;

  const displayVolume =
    unit === "metric"
      ? `${(af * 0.00123348).toFixed(2)} Million m³`
      : `${af.toLocaleString()} Acre-Feet (AF)`;

  return (
    <div className="bg-slate-900 text-white rounded-lg shadow-xl p-3 border border-slate-700 text-xs space-y-1.5 min-w-[200px]">
      <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1 flex items-center justify-between">
        <span>{dataPoint.fullDate || dataPoint.date}</span>
      </div>

      <div className="space-y-1 pt-0.5">
        <div className="flex justify-between items-center gap-4">
          <span className="text-slate-400">Storage Volume:</span>
          <span className="font-black text-white">{displayVolume}</span>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-slate-400">% of 200k Capacity:</span>
          <span className="font-bold text-sky-400">{pct}% full</span>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-slate-400">Available Headroom:</span>
          <span className="text-slate-300">
            {Math.max(0, capacityAf - af).toLocaleString()} AF
          </span>
        </div>
      </div>
    </div>
  );
};
