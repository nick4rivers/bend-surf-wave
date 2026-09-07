import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Thermometer,
  ShieldCheck,
  Sun,
  Cloud,
  Snowflake,
  Layers,
  Activity,
  ExternalLink,
  Wind,
  AlertTriangle,
  Info,
} from "lucide-react";
import { SurfDataResponse, TimeRange, UnitType } from "../types";
import { formatHydroDateTime } from "../utils/dateUtils";

interface TempGraphProps {
  data: SurfDataResponse;
  unit: UnitType;
}

export const TempGraph: React.FC<TempGraphProps> = ({ data, unit }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [showAirTemp, setShowAirTemp] = useState(true);

  const airQuality = data.airQuality || {
    aqi: 28,
    rating: "Fresh AF",
    category: "Good (0–50 AQI)",
    color: "emerald",
    description: "Pristine Cascade mountain air quality at Bend Whitewater Park.",
    recommendation: "Ideal conditions for high-exertion river surfing & paddling. Full lung capacity!",
    pm2_5: 6.8,
    pm10: 9.5,
    ozone: 40.0,
    updatedAt: "Live",
    source: "PurpleAir (Colorado Ave Station #61853)",
    sourceUrl: "https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=61853#15/44.0474/-121.3182",
    sensorName: "Colorado Avenue",
    sensorIndex: 61853,
    distance: "0.17 miles from Surf Wave",
    pm2_5_10m: 6.8,
  };

  // Standard AQI Scale tiers for River Athletes
  const aqiTiers = [
    {
      range: "0 – 50",
      rating: "Fresh AF",
      label: "Good / Clean Air",
      color: "emerald",
      bgClass: "bg-emerald-50 border-emerald-300 text-emerald-800",
      barClass: "bg-emerald-500",
      active: airQuality.aqi <= 50,
      rec: "Ideal conditions for high-exertion paddling & surfing. Pristine Cascade mountain air.",
    },
    {
      range: "51 – 100",
      rating: "Moderate",
      label: "Moderate Quality",
      color: "amber",
      bgClass: "bg-amber-50 border-amber-300 text-amber-800",
      barClass: "bg-amber-400",
      active: airQuality.aqi >= 51 && airQuality.aqi <= 100,
      rec: "Acceptable for river surfing. Sensitive surfers should monitor breathing comfort.",
    },
    {
      range: "101 – 150",
      rating: "Sensitive Warning",
      label: "Unhealthy for Sensitive Groups",
      color: "orange",
      bgClass: "bg-orange-50 border-orange-300 text-orange-800",
      barClass: "bg-orange-400",
      active: airQuality.aqi >= 101 && airQuality.aqi <= 150,
      rec: "Smoke haze present in Deschutes basin. Surfers with asthma or sensitive lungs should shorten sessions.",
    },
    {
      range: "151 – 200",
      rating: "Unhealthy",
      label: "Unhealthy (Active Smoke)",
      color: "rose",
      bgClass: "bg-rose-50 border-rose-300 text-rose-800",
      barClass: "bg-rose-500",
      active: airQuality.aqi >= 151 && airQuality.aqi <= 200,
      rec: "Active smoke in river canyon. Everyone may experience throat irritation; avoid heavy cardio.",
    },
    {
      range: "201 – 300",
      rating: "Very Unhealthy",
      label: "Very Unhealthy (Dense Smoke)",
      color: "purple",
      bgClass: "bg-purple-50 border-purple-300 text-purple-800",
      barClass: "bg-purple-600",
      active: airQuality.aqi >= 201 && airQuality.aqi <= 300,
      rec: "Health alert: high risk of respiratory irritation. Avoid river surf sessions.",
    },
    {
      range: "301+",
      rating: "Hazardous",
      label: "Hazardous (Emergency)",
      color: "maroon",
      bgClass: "bg-rose-950/10 border-rose-900 text-rose-950",
      barClass: "bg-rose-900",
      active: airQuality.aqi >= 301,
      rec: "Severe emergency smoke inversion layer across Central Oregon. Remain indoors.",
    },
  ];

  // Filter temperature series based on selected range
  const filteredData = useMemo(() => {
    const raw = data.timeSeries.temperature;
    if (!raw || raw.length === 0) return [];

    let count = raw.length;
    if (timeRange === "24h") {
      count = Math.min(raw.length, 24); // hourly
    } else if (timeRange === "7d") {
      count = Math.min(raw.length, 24 * 7);
    } else if (timeRange === "30d") {
      count = Math.min(raw.length, 24 * 30);
    }

    const sliced = raw.slice(-count);

    return sliced.map((item) => {
      const { shortDate, shortTime, shortLabel, displayTime } = formatHydroDateTime(
        item.date,
        timeRange
      );

      const wTemp = typeof item.waterTemp === "number" && !isNaN(item.waterTemp) ? item.waterTemp : 50;
      const aTemp = typeof item.airTemp === "number" && !isNaN(item.airTemp) ? item.airTemp : 65;
      const waterC = parseFloat((((wTemp - 32) * 5) / 9).toFixed(1));
      const airC = parseFloat((((aTemp - 32) * 5) / 9).toFixed(1));

      return {
        ...item,
        waterTemp: wTemp,
        airTemp: aTemp,
        shortDate,
        shortTime,
        shortLabel,
        displayTime,
        displayWater: unit === "metric" ? waterC : wTemp,
        displayAir: unit === "metric" ? airC : aTemp,
      };
    });
  }, [data.timeSeries.temperature, timeRange, unit]);

  // Dynamic Y-axis domain:
  // When air temp is toggled off, automatically adjust to the water temperature range so subtle changes are visible
  const yDomain = useMemo<[number, number]>(() => {
    if (showAirTemp) {
      // When air temp is included, standard full scale (or encompassing all air + water values)
      if (!filteredData || filteredData.length === 0) {
        return unit === "metric" ? [0, 40] : [35, 95];
      }
      const allValues = filteredData
        .flatMap((d) => [d.displayWater, d.displayAir])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));

      if (allValues.length === 0) {
        return unit === "metric" ? [0, 40] : [35, 95];
      }

      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const defaultMin = unit === "metric" ? 0 : 35;
      const defaultMax = unit === "metric" ? 40 : 95;

      return [
        Math.min(defaultMin, Math.floor(minVal - 2)),
        Math.max(defaultMax, Math.ceil(maxVal + 2)),
      ];
    }

    // When air temp is toggled off, zoom in on the water temperature range
    if (!filteredData || filteredData.length === 0) {
      return unit === "metric" ? [5, 25] : [40, 75];
    }

    const waterValues = filteredData
      .map((d) => d.displayWater)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (waterValues.length === 0) {
      return unit === "metric" ? [5, 25] : [40, 75];
    }

    const minVal = Math.min(...waterValues);
    const maxVal = Math.max(...waterValues);
    const diff = maxVal - minVal;

    if (unit === "metric") {
      const pad = Math.max(1, diff * 0.15);
      const minDomain = Math.max(0, Math.floor((minVal - pad) * 2) / 2);
      const maxDomain = Math.ceil((maxVal + pad) * 2) / 2;
      return [minDomain, maxDomain];
    } else {
      const pad = Math.max(1.5, diff * 0.15);
      const minDomain = Math.max(32, Math.floor(minVal - pad));
      const maxDomain = Math.ceil(maxVal + pad);
      return [minDomain, maxDomain];
    }
  }, [showAirTemp, filteredData, unit]);

  const ref62Val = 62;
  const ref58Val = 58;
  const ref54Val = 54;

  // Only show reference lines if they fall within the active Y domain
  const showRef62 = ref62Val >= yDomain[0] && ref62Val <= yDomain[1];
  const showRef58 = ref58Val >= yDomain[0] && ref58Val <= yDomain[1];
  const showRef54 = ref54Val >= yDomain[0] && ref54Val <= yDomain[1];

  // Current reading
  const current = data.current;

  // Water rating helper based on user's 4 thresholds
  const waterRatingInfo = useMemo(() => {
    const wTemp = current.waterTempF ?? 50;
    if (wTemp >= 62) {
      return {
        label: "Balmy",
        badgeClass: "bg-emerald-600 text-white",
        borderClass: "bg-emerald-50 border-emerald-300 text-emerald-800",
        gear: "Wetsuits optional; boardies and bikinis recommended",
        notes: "Our short central OR summer days, don't miss it.",
      };
    }
    if (wTemp >= 58) {
      return {
        label: "Comfortable",
        badgeClass: "bg-sky-600 text-white",
        borderClass: "bg-sky-50 border-sky-300 text-sky-800",
        gear: "3/2 wetsuits and spring suits",
        notes: "Summer shoulder season, peak summer mornings and evenings.",
      };
    }
    if (wTemp >= 54) {
      return {
        label: "Cool",
        badgeClass: "bg-indigo-600 text-white",
        borderClass: "bg-indigo-50 border-indigo-300 text-indigo-800",
        gear: "3/2 to 4/3 wetsuits. Booties and gloves optional.",
        notes: "Typical Spring and Fall afternoon surf sessions.",
      };
    }
    return {
      label: "Cold",
      badgeClass: "bg-blue-600 text-white",
      borderClass: "bg-blue-50 border-blue-300 text-blue-800",
      gear: "4/3 to 5/4 wetsuits. Booties, gloves, and hoods.",
      notes: "The Deschutes - most of the year",
    };
  }, [current.waterTempF]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const wF = point.waterTemp;
      const aF = point.airTemp;

      let wetsuitGuide = "4/3 to 5/4 wetsuits. Booties, gloves, and hoods.";
      let tierLabel = "Cold";
      if (wF >= 62) {
        tierLabel = "Balmy";
        wetsuitGuide = "Wetsuits optional; boardies and bikinis recommended";
      } else if (wF >= 58) {
        tierLabel = "Comfortable";
        wetsuitGuide = "3/2 wetsuits and spring suits";
      } else if (wF >= 54) {
        tierLabel = "Cool";
        wetsuitGuide = "3/2 to 4/3 wetsuits. Booties and gloves optional.";
      }

      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[230px]">
          <div className="text-slate-300 font-medium border-b border-slate-800 pb-1.5 flex justify-between items-center">
            <span className="font-semibold text-slate-200">{point.displayTime}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              Deschutes BENO
            </span>
          </div>

          <div className="space-y-1 pt-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sky-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Water Temp:
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {wF}°F
              </span>
            </div>

            {showAirTemp && aF > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Air Temp:
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {aF}°F
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Water Rating
              </span>
              <span className="text-[10px] font-bold text-sky-400 uppercase">
                {tierLabel}
              </span>
            </div>
            <span className="text-emerald-300 font-semibold text-[11px] block leading-tight">
              {wetsuitGuide}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Real-Time Wetsuit Recommender */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current Water Temp & Gear Card */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Thermometer className="w-4 h-4 text-sky-600" />
                Live Water Temperature
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                BENO Gage (~10 mi upstream)
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <span className="text-4xl sm:text-5xl font-light text-sky-600 tracking-tight font-mono">
                {current.waterTempF}°F
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${waterRatingInfo.badgeClass}`}>
                {waterRatingInfo.label}
              </span>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900">{waterRatingInfo.gear}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {waterRatingInfo.notes}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Thermal Rating:</span>
                <span className="text-sky-700 font-bold">{waterRatingInfo.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wetsuit Matrix & Season Guide */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-sky-600" />
                Deschutes River Water Temperature
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* 62°F+: Balmy */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  current.waterTempF >= 62
                    ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/30 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-emerald-700">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> 62°F+: Balmy
                  </span>
                  {current.waterTempF >= 62 && (
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                      CURRENT ZONE
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-1.5 text-xs">
                  Wetsuits optional; boardies and bikinis recommended
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Our short central OR summer days, don't miss it.
                </p>
              </div>

              {/* 58°F - 62°F: Comfortable */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  current.waterTempF >= 58 && current.waterTempF < 62
                    ? "bg-sky-50/80 border-sky-300 ring-2 ring-sky-400/30 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sky-700">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Sun className="w-3.5 h-3.5 text-sky-500" /> 58°F – 62°F: Comfortable
                  </span>
                  {current.waterTempF >= 58 && current.waterTempF < 62 && (
                    <span className="text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                      CURRENT ZONE
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-1.5 text-xs">
                  3/2 wetsuits and spring suits
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Summer shoulder season, peak summer mornings and evenings.
                </p>
              </div>

              {/* 54°F - 58°F: Cool */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  current.waterTempF >= 54 && current.waterTempF < 58
                    ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/30 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-indigo-700">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Cloud className="w-3.5 h-3.5 text-indigo-500" /> 54°F – 58°F: Cool
                  </span>
                  {current.waterTempF >= 54 && current.waterTempF < 58 && (
                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                      CURRENT ZONE
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-1.5 text-xs">
                  3/2 to 4/3 wetsuits. Booties and gloves optional.
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Typical Spring and Fall afternoon surf sessions.
                </p>
              </div>

              {/* < 54°F: Cold */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  current.waterTempF < 54
                    ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/30 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-blue-700">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Snowflake className="w-3.5 h-3.5 text-blue-500" /> &lt; 54°F: Cold
                  </span>
                  {current.waterTempF < 54 && (
                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                      CURRENT ZONE
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-1.5 text-xs">
                  4/3 to 5/4 wetsuits. Booties, gloves, and hoods.
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  The Deschutes - most of the year
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Temperature Graph */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Water &amp; Air Temperature
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Water temperature recorded at BENO gauge (~10 miles south/upstream of park at Benham Falls)
            </p>
          </div>

          {/* Time Range Filter & Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
              {(["24h", "7d", "30d"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  id={`range-temp-${r}`}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    timeRange === r
                      ? "bg-white text-sky-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r === "24h" ? "24 Hours" : r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>

            <button
              id="toggle-air-temp-btn"
              onClick={() => setShowAirTemp(!showAirTemp)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                showAirTemp
                  ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                  : "bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100 shadow-sm"
              }`}
            >
              <Sun className={`w-3.5 h-3.5 ${showAirTemp ? "text-amber-600" : "text-sky-600"}`} />
              <span>Air Temp ({showAirTemp ? "On" : "Off • Water Range"})</span>
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-80 sm:h-96 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 15, right: 20, left: -5, bottom: 5 }}>
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
                domain={yDomain}
                allowDataOverflow={true}
                unit={unit === "metric" ? "°C" : "°F"}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Temperature Threshold Reference Lines (62°F, 58°F, 54°F) */}
              {showRef62 && (
                <ReferenceLine
                  y={ref62Val}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "62°F — Balmy",
                    fill: "#047857",
                    fontSize: 10,
                    fontWeight: 600,
                    position: "insideTopRight",
                  }}
                />
              )}
              {showRef58 && (
                <ReferenceLine
                  y={ref58Val}
                  stroke="#0284c7"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "58°F — Comfortable",
                    fill: "#0369a1",
                    fontSize: 10,
                    fontWeight: 600,
                    position: "insideTopRight",
                  }}
                />
              )}
              {showRef54 && (
                <ReferenceLine
                  y={ref54Val}
                  stroke="#4f46e5"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "54°F — Cool / Cold Threshold",
                    fill: "#4338ca",
                    fontSize: 10,
                    fontWeight: 600,
                    position: "insideTopRight",
                  }}
                />
              )}

              {/* Water Temp Line - Bold vibrant cyan/sky line */}
              <Line
                type="monotone"
                dataKey="displayWater"
                name="Water Temperature"
                stroke="#0284c7"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
              />

              {/* Air Temp Line - Distinct amber/orange dashed line with high contrast against reference lines */}
              {showAirTemp && (
                <Line
                  type="monotone"
                  dataKey="displayAir"
                  name="Air Temperature"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  activeDot={{ r: 4, fill: "#f59e0b", stroke: "#ffffff", strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend under graph */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-sky-700">
              <span className="w-4 h-1 bg-sky-600 rounded-full" /> Water Temp
            </span>
            {showAirTemp && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                <span className="w-4 h-0.5 border-b-2 border-amber-500 border-dashed" /> Air Temp
              </span>
            )}
            {showRef62 && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-3 h-0.5 bg-emerald-600 border-dashed" /> 62°F Balmy
              </span>
            )}
            {showRef58 && (
              <span className="flex items-center gap-1.5 font-medium text-sky-700">
                <span className="w-3 h-0.5 bg-sky-600 border-dashed" /> 58°F Comfortable
              </span>
            )}
            {showRef54 && (
              <span className="flex items-center gap-1.5 font-medium text-indigo-700">
                <span className="w-3 h-0.5 bg-indigo-600 border-dashed" /> 54°F Cool / Cold
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Air Quality (AQI) & Smoke Advisory Section (PurpleAir Nearest Sensor) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Live Air Quality &amp; Smoke Index (PurpleAir)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live PM2.5 &amp; EPA AQI from nearest sensor: <span className="font-semibold text-slate-700">{airQuality.sensorName || "Colorado Avenue"}</span> ({airQuality.distance || "0.17 mi from wave"})
            </p>
          </div>

          <a
            href={airQuality.sourceUrl || "https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=61853#15/44.0474/-121.3182"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg transition"
          >
            <span>PurpleAir: Colorado Ave (#61853 • 0.17 mi)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Current AQI Banner & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          {/* Main AQI Badge Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Real-Time Air Quality
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  airQuality.aqi <= 50
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                    : airQuality.aqi <= 100
                    ? "bg-amber-950/80 text-amber-300 border-amber-700"
                    : airQuality.aqi <= 150
                    ? "bg-orange-950/80 text-orange-300 border-orange-700"
                    : airQuality.aqi <= 200
                    ? "bg-rose-950/80 text-rose-300 border-rose-700"
                    : "bg-purple-950/80 text-purple-300 border-purple-700"
                }`}>
                  {airQuality.rating}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-3">
                <span className={`text-4xl sm:text-5xl font-light tracking-tight font-mono ${
                  airQuality.aqi <= 50
                    ? "text-emerald-400"
                    : airQuality.aqi <= 100
                    ? "text-amber-400"
                    : airQuality.aqi <= 150
                    ? "text-orange-400"
                    : "text-rose-400"
                }`}>
                  {airQuality.aqi}
                </span>
                <span className="text-sm font-bold text-slate-400 font-mono">
                  AQI
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-2 font-medium">
                {airQuality.description}
              </p>
            </div>

            {/* Particulate & Gas Sensors */}
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-[10px] text-slate-400 block font-mono">PM2.5</span>
                <span className="font-bold text-white font-mono">{airQuality.pm2_5} <span className="text-[9px] font-normal text-slate-400">µg/m³</span></span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-[10px] text-slate-400 block font-mono">PM10</span>
                <span className="font-bold text-white font-mono">{airQuality.pm10 || "9.5"} <span className="text-[9px] font-normal text-slate-400">µg/m³</span></span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-[10px] text-slate-400 block font-mono">Ozone</span>
                <span className="font-bold text-white font-mono">{airQuality.ozone || "40"} <span className="text-[9px] font-normal text-slate-400">µg/m³</span></span>
              </div>
            </div>

            <div className="mt-3 text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>Source: {airQuality.source || "PurpleAir (Colorado Ave Station #61853)"}</span>
              <span>{airQuality.updatedAt}</span>
            </div>
          </div>

          {/* Standard AQI Scale Reference Guide */}
          <div className="lg:col-span-2 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Deschutes River Surfer &amp; Paddler Health Advisory
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {aqiTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                    tier.active
                      ? `${tier.bgClass} ring-2 ring-slate-900 shadow-sm`
                      : "bg-slate-50/70 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${tier.barClass}`} />
                      <span>{tier.rating}</span>
                      <span className="text-[11px] font-mono text-slate-500 font-normal">({tier.range})</span>
                    </div>
                    {tier.active && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {tier.rec}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

