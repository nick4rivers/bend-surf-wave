import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { MetricCards } from "./components/MetricCards";
import { FlowGraph } from "./components/FlowGraph";
import { TempGraph } from "./components/TempGraph";
import { HydroNetworkGraph } from "./components/HydroNetworkGraph";
import { HistoricalGraph } from "./components/HistoricalGraph";
import { CamsAndWeather } from "./components/CamsAndWeather";
import { SurfDataResponse, ActiveTab, UnitType } from "./types";
import { Waves, RefreshCw, AlertCircle } from "lucide-react";

export default function App() {
  const [data, setData] = useState<SurfDataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [unit, setUnit] = useState<UnitType>("imperial");

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/surf-data");
      if (!res.ok) {
        throw new Error(`Failed to fetch surf data (Status: ${res.status})`);
      }
      const json: SurfDataResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Error fetching surf data:", err);
      setError(err.message || "Failed to load river surf report data.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 3 minutes
    const interval = setInterval(() => {
      fetchData(false);
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 p-3 shadow-sm flex items-center justify-center">
            <Waves className="h-8 w-8 text-sky-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Retrieving Live River Data...
          </h2>
          <p className="text-xs text-slate-500">
            Pulling instantaneous USGS discharge, Deschutes temperature, and canal gages for Bend Whitewater Park.
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="bg-white border border-rose-200 rounded-xl p-6 max-w-md text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">River Gage Connection Issue</h2>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition inline-flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-sky-600 selection:text-white">
      {/* Header with quick status & navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unit={unit}
        setUnit={setUnit}
        loading={loading}
        onRefresh={() => fetchData(true)}
        lastUpdated={data.upstreamGages?.date || data.lastUpdated}
        currentCfs={data.current.flowCfs}
        statusLabel={data.current.statusLabel}
        currentWaterTempF={data.current.waterTempF}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <MetricCards
              data={data}
              unit={unit}
              onNavigateToFlow={() => setActiveTab("flow")}
              onNavigateToTemp={() => setActiveTab("temperature")}
              onNavigateToCanals={() => setActiveTab("flow")}
              onNavigateToWeather={() => setActiveTab("cams-weather")}
            />

            {/* Flow & Temperature chart sections stacked full-width */}
            <div className="flex flex-col gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-base">
                      Recent Flow Trend (CFS)
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("flow")}
                    className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1"
                  >
                    Full Hydrograph &rarr;
                  </button>
                </div>
                <div className="py-2">
                  <FlowGraph data={data} unit={unit} />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-base">
                      Water Temp & Wetsuit Guide
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("temperature")}
                    className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1"
                  >
                    Full Temperature Log &rarr;
                  </button>
                </div>
                <div className="py-2">
                  <TempGraph data={data} unit={unit} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "flow" && (
          <div className="animate-in fade-in duration-300 space-y-8">
            <FlowGraph data={data} unit={unit} />
            <HydroNetworkGraph data={data} unit={unit} />
          </div>
        )}

        {activeTab === "temperature" && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <TempGraph data={data} unit={unit} />
          </div>
        )}

        {activeTab === "historical" && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <HistoricalGraph data={data} unit={unit} />
          </div>
        )}

        {activeTab === "cams-weather" && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <CamsAndWeather data={data} unit={unit} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-800 font-bold">
              <Waves className="w-4 h-4 text-sky-600" />
              <span>Bend Surf Wave</span>
            </div>

            <div className="text-[11px] text-slate-400">
              <p>
                Adapted from the <span className="font-semibold text-slate-600">Green Wave Surf Report Website</span>.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
