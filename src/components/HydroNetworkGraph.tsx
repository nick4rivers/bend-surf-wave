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
} from "recharts";
import {
  Compass,
  ArrowRight,
  Droplets,
  Layers,
  Info,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import { SurfDataResponse, TimeRange, UnitType } from "../types";
import { formatHydroDateTime } from "../utils/dateUtils";

interface HydroNetworkProps {
  data: SurfDataResponse;
  unit: UnitType;
}

export const HydroNetworkGraph: React.FC<HydroNetworkProps> = ({ data, unit }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [visibleGages, setVisibleGages] = useState<{ [key: string]: boolean }>({
    headOfPark: true,
    benham: true,
    wickiup: true,
    centralOregonCanal: true,
    arnoldCanal: false,
    littleDeschutes: false,
  });

  const toggleGage = (key: string) => {
    setVisibleGages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredData = useMemo(() => {
    const raw = data.timeSeries.canals;
    if (!raw || raw.length === 0) return [];

    let count = raw.length;
    if (timeRange === "24h") count = Math.min(raw.length, 96);
    else if (timeRange === "7d") count = Math.min(raw.length, 96 * 7);
    else if (timeRange === "30d") count = Math.min(raw.length, 96 * 30);

    const sliced = raw.slice(-count);

    return sliced.map((item) => {
      const { shortDate, shortTime, shortLabel, displayTime } = formatHydroDateTime(
        item.date,
        timeRange
      );

      const factor = unit === "metric" ? 0.0283168 : 1;

      return {
        ...item,
        shortDate,
        shortTime,
        shortLabel,
        displayTime,
        displayHeadOfPark: parseFloat(((item.headOfPark ?? 0) * factor).toFixed(1)),
        displayBenham: parseFloat(((item.benham ?? 0) * factor).toFixed(1)),
        displayWickiup: parseFloat(((item.wickiup ?? 0) * factor).toFixed(1)),
        displayCeno: parseFloat(((item.centralOregonCanal ?? 0) * factor).toFixed(1)),
        displayArno: parseFloat(((item.arnoldCanal ?? 0) * factor).toFixed(1)),
        displayLapo: parseFloat(((item.littleDeschutes ?? 0) * factor).toFixed(1)),
      };
    });
  }, [data.timeSeries.canals, timeRange, unit]);

  const latest = data.upstreamGages || {
    wickiup: 1410,
    benham: 2360,
    centralOregonCanal: 740,
    arnoldCanal: 110,
    headOfPark: 905,
    littleDeschutes: 190,
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[240px]">
          <div className="text-slate-400 font-medium border-b border-slate-800 pb-1 flex justify-between">
            <span>{point.displayTime}</span>
            <span className="font-mono text-emerald-400">Deschutes River System</span>
          </div>

          <div className="space-y-1 pt-1">
            {visibleGages.headOfPark && (
              <div className="flex justify-between items-center text-emerald-400 font-bold">
                <span>Head of Park (Surf Wave):</span>
                <span className="font-mono">{point.displayHeadOfPark} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
            {visibleGages.benham && (
              <div className="flex justify-between items-center text-cyan-400">
                <span>Benham Falls (BENO):</span>
                <span className="font-mono">{point.displayBenham} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
            {visibleGages.wickiup && (
              <div className="flex justify-between items-center text-purple-400">
                <span>Wickiup Reservoir Outflow:</span>
                <span className="font-mono">{point.displayWickiup} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
            {visibleGages.centralOregonCanal && (
              <div className="flex justify-between items-center text-amber-400">
                <span>Central Oregon Canal (CENO):</span>
                <span className="font-mono">-{point.displayCeno} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
            {visibleGages.arnoldCanal && (
              <div className="flex justify-between items-center text-rose-400">
                <span>Arnold Canal (ARNO):</span>
                <span className="font-mono">-{point.displayArno} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
            {visibleGages.littleDeschutes && (
              <div className="flex justify-between items-center text-blue-400">
                <span>Little Deschutes (LAPO):</span>
                <span className="font-mono">+{point.displayLapo} {unit === "metric" ? "m³/s" : "CFS"}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Topology / Flow Diagram */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Upper Deschutes River Flow Balance & Canal Topology
            </h3>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline font-mono">
            USBR Hydromet & OWRD Network
          </span>
        </div>

        {/* Schematic Flow Steps */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Step 1: Wickiup */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                1. Upstream Storage
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Wickiup Reservoir</h4>
              <p className="text-slate-500 text-xs mt-1">Dam release baseline</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200">
              <span className="text-lg font-light font-mono text-purple-700">
                {unit === "metric" ? (((latest.wickiup ?? 0) * 0.0283).toFixed(1) + " m³/s") : `${latest.wickiup ?? 0} CFS`}
              </span>
            </div>
          </div>

          {/* Step 2: Benham Falls */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
                2. River Inflow
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Benham Falls (BENO)</h4>
              <p className="text-slate-500 text-xs mt-1">Mainstem Deschutes gage</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200">
              <span className="text-lg font-light font-mono text-sky-700">
                {unit === "metric" ? (((latest.benham ?? 0) * 0.0283).toFixed(1) + " m³/s") : `${latest.benham ?? 0} CFS`}
              </span>
            </div>
          </div>

          {/* Step 3: Canal Diversions */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                3. Irrigation Diversion
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Central & Arnold</h4>
              <p className="text-slate-500 text-xs mt-1">CENO ({latest.centralOregonCanal ?? 0}) + ARNO ({latest.arnoldCanal ?? 0})</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200">
              <span className="text-lg font-light font-mono text-amber-700">
                -{unit === "metric" ? ((((latest.centralOregonCanal ?? 0) + (latest.arnoldCanal ?? 0)) * 0.0283).toFixed(1) + " m³/s") : `${((latest.centralOregonCanal ?? 0) + (latest.arnoldCanal ?? 0)).toFixed(0)} CFS`}
              </span>
            </div>
          </div>

          {/* Step 4: Bend Surf Wave (Head of Park) */}
          <div className="bg-emerald-50/60 border border-emerald-300 ring-1 ring-emerald-400 rounded-lg p-3.5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                4. Surf Destination
              </span>
              <h4 className="font-bold text-emerald-950 text-sm mt-0.5">Bend Surf Wave (Park)</h4>
              <p className="text-emerald-800 text-xs mt-1">Net flow at wave feature</p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-200">
              <span className="text-xl font-bold font-mono text-emerald-800">
                {unit === "metric" ? (((latest.headOfPark ?? 0) * 0.0283).toFixed(1) + " m³/s") : `${latest.headOfPark ?? 0} CFS`}
              </span>
            </div>
          </div>

          {/* Step 5: Downstream */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                5. Downstream
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Below Bend (14070500)</h4>
              <p className="text-slate-500 text-xs mt-1">Continues toward Lake Billy</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200">
              <span className="text-lg font-light font-mono text-slate-700">
                {data.usgsGages?.["14070500"]?.cfs ? (unit === "metric" ? ((data.usgsGages["14070500"].cfs * 0.0283).toFixed(1) + " m³/s") : `${data.usgsGages["14070500"].cfs} CFS`) : "1,120 CFS"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Gage Comparison Hydrograph */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Upper River & Canal Hydrographs
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click gage badges below to toggle traces on and off
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
            {(["24h", "7d", "30d", "all"] as TimeRange[]).map((r) => (
              <button
                key={r}
                id={`range-canals-${r}`}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  timeRange === r
                    ? "bg-white text-sky-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r === "24h" ? "24 Hours" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "Full Season"}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Gage Toggles */}
        <div className="flex flex-wrap gap-2 my-4">
          <button
            onClick={() => toggleGage("headOfPark")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.headOfPark
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Head of Park (Surf Wave)
          </button>

          <button
            onClick={() => toggleGage("benham")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.benham
                ? "bg-sky-50 border-sky-300 text-sky-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            Benham Falls (BENO)
          </button>

          <button
            onClick={() => toggleGage("wickiup")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.wickiup
                ? "bg-purple-50 border-purple-300 text-purple-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            Wickiup Outflow
          </button>

          <button
            onClick={() => toggleGage("centralOregonCanal")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.centralOregonCanal
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Central Oregon Canal (CENO)
          </button>

          <button
            onClick={() => toggleGage("arnoldCanal")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.arnoldCanal
                ? "bg-rose-50 border-rose-300 text-rose-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Arnold Canal (ARNO)
          </button>

          <button
            onClick={() => toggleGage("littleDeschutes")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              visibleGages.littleDeschutes
                ? "bg-blue-50 border-blue-300 text-blue-800"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            Little Deschutes (LAPO)
          </button>
        </div>

        {/* Chart */}
        <div className="h-80 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                domain={["auto", "auto"]}
                unit={unit === "metric" ? " m³" : " cfs"}
              />

              <Tooltip content={<CustomTooltip />} />

              {visibleGages.headOfPark && (
                <Line
                  type="monotone"
                  dataKey="displayHeadOfPark"
                  name="Head of Park (Green Wave)"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={false}
                />
              )}

              {visibleGages.benham && (
                <Line
                  type="monotone"
                  dataKey="displayBenham"
                  name="Benham Falls"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {visibleGages.wickiup && (
                <Line
                  type="monotone"
                  dataKey="displayWickiup"
                  name="Wickiup Outflow"
                  stroke="#9333ea"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {visibleGages.centralOregonCanal && (
                <Line
                  type="monotone"
                  dataKey="displayCeno"
                  name="Central Oregon Canal"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {visibleGages.arnoldCanal && (
                <Line
                  type="monotone"
                  dataKey="displayArno"
                  name="Arnold Canal"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {visibleGages.littleDeschutes && (
                <Line
                  type="monotone"
                  dataKey="displayLapo"
                  name="Little Deschutes"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
