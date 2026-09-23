import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SurfDataResponse } from "../types";

interface AiSurfReportTextProps {
  data: SurfDataResponse;
  unit: "imperial" | "metric";
}

interface ReportState {
  report: string;
  source: string;
  generatedAt: string;
  cached?: boolean;
}

export const AiSurfReportText: React.FC<AiSurfReportTextProps> = ({ data, unit }) => {
  const [reportData, setReportData] = useState<ReportState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Extract flow metrics and previous days' flows
  const currentCfs = data.current?.flowCfs ?? 0;
  const flowTrendDiff = data.current?.flowTrendDiff ?? 0;
  const flowSeries = data.timeSeries?.flow || [];

  // Find yesterday & 2-days-ago flows from timeSeries
  let yesterdayCfs: number | undefined;
  let twoDaysAgoCfs: number | undefined;

  if (flowSeries.length >= 2) {
    yesterdayCfs = Math.round(flowSeries[flowSeries.length - 2]?.cfs || 0);
  }
  if (flowSeries.length >= 3) {
    twoDaysAgoCfs = Math.round(flowSeries[flowSeries.length - 3]?.cfs || 0);
  }

  // Today's forecast high from Open-Meteo daily weather
  const todayHigh = data.weather?.daily?.temperature_2m_max?.[0] ?? (data.current?.airTempF ? data.current.airTempF + 5 : 72);
  const weatherCode = data.weather?.current?.weather_code ?? 0;
  const weatherDesc = weatherCode === 0 ? "Clear skies" : weatherCode <= 3 ? "Partly cloudy" : "Sunny";

  // Air quality
  const aqi = data.airQuality?.aqi;
  const aqiCategory = data.airQuality?.category;
  const aqiRating = data.airQuality?.rating;

  const fetchAiReport = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      const conditionsPayload = {
        currentCfs,
        flowTrendDiff,
        statusLabel: data.current?.statusLabel || "Surfing",
        statusRating: data.current?.statusRating || "SURFING",
        yesterdayCfs,
        twoDaysAgoCfs,
        flowTrendDescription:
          flowTrendDiff > 5
            ? `Rising (+${flowTrendDiff} CFS)`
            : flowTrendDiff < -5
            ? `Dropping (${flowTrendDiff} CFS)`
            : "Holding steady",
        waterTempF: data.current?.waterTempF,
        airTempF: data.current?.airTempF,
        highTempF: todayHigh,
        weatherCondition: weatherDesc,
        aqi,
        aqiCategory,
        aqiRating,
        refresh: forceRefresh,
      };

      try {
        const response = await fetch("/api/ai-surf-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(conditionsPayload),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const json = await response.json();
        if (json.report) {
          setReportData({
            report: json.report,
            source: json.source || "Gemini",
            generatedAt: json.generatedAt || new Date().toISOString(),
            cached: json.cached,
          });
        } else {
          throw new Error("Empty report received");
        }
      } catch (err: any) {
        console.warn("Failed to fetch surf report, using default brief:", err);
        setError(err.message || "Failed to generate report");
        // Fallback to data.current.statusDescription if available
        setReportData({
          report:
            data.current?.statusDescription ||
            `Flows are running at ${currentCfs} CFS with solid push on the face. Highs reach near ${Math.round(
              todayHigh
            )}°F today with fresh air across the river corridor.`,
          source: "Condition Brief",
          generatedAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    },
    [
      currentCfs,
      flowTrendDiff,
      yesterdayCfs,
      twoDaysAgoCfs,
      todayHigh,
      weatherDesc,
      aqi,
      aqiCategory,
      aqiRating,
      data.current?.statusLabel,
      data.current?.statusRating,
      data.current?.waterTempF,
      data.current?.airTempF,
      data.current?.statusDescription,
    ]
  );

  useEffect(() => {
    fetchAiReport(false);
  }, [fetchAiReport]);

  return (
    <div className="space-y-1.5 max-w-2xl">
      <div className="flex items-center gap-2 text-[11px] font-medium text-sky-400">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 font-mono tracking-wide uppercase text-[10px]">
          <Sparkles className={`w-3 h-3 text-sky-400 ${loading ? "animate-spin" : ""}`} />
          Surf Report
        </span>

        {reportData?.source && !loading && (
          <span className="text-slate-400 text-[10px] hidden sm:inline">
            • {reportData.source.includes("Gemini") ? "Powered by Gemini 3.8" : reportData.source}
          </span>
        )}

        <button
          onClick={() => fetchAiReport(true)}
          disabled={loading}
          title="Regenerate surf report from current conditions"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-sky-400" : ""}`} />
          <span className="hidden xs:inline">{loading ? "Generating..." : "Regenerate"}</span>
        </button>
      </div>

      {loading && !reportData?.report ? (
        <div className="flex items-center gap-2.5 py-1 text-slate-300 text-xs sm:text-sm animate-pulse">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>Generating surf report...</span>
        </div>
      ) : (
        <p className="text-slate-200 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
          {reportData?.report}
        </p>
      )}
    </div>
  );
};
