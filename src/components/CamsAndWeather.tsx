import React from "react";
import {
  Video,
  Sun,
  Sunrise,
  Sunset,
  ExternalLink,
  Wind,
  Droplets,
  CloudSun,
  Compass,
} from "lucide-react";
import { SurfDataResponse, UnitType } from "../types";

interface CamsAndWeatherProps {
  data: SurfDataResponse;
  unit: UnitType;
}

export const CamsAndWeather: React.FC<CamsAndWeatherProps> = ({ data, unit }) => {
  const weather = data.weather;

  const formatTemp = (tempF: number | null | undefined) => {
    if (typeof tempF !== "number" || isNaN(tempF)) return "--";
    if (unit === "metric") {
      return `${(((tempF - 32) * 5) / 9).toFixed(1)}°C`;
    }
    return `${Math.round(tempF)}°F`;
  };

  const formatWindSpeed = (speedMph: number | null | undefined) => {
    if (typeof speedMph !== "number" || isNaN(speedMph)) return "--";
    if (unit === "metric") {
      return `${(speedMph * 1.60934).toFixed(1)} km/h`;
    }
    return `${Math.round(speedMph)} mph`;
  };

  return (
    <div className="space-y-6">
      {/* Live Webcams Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
              Live River &amp; Surf Webcam
            </h3>
          </div>
        </div>

        {/* Video Player / Stream Embed Area */}
        <div className="mt-4">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
            <iframe
              src="https://www.youtube.com/embed/uBqGtbSNzu8?autoplay=0&mute=1"
              title="Bend Whitewater Park Live Stream - The Bend Bulletin"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-700">Live Cam</span>
            </div>

            <a
              href="https://www.youtube.com/live/uBqGtbSNzu8?si=z8h6pRlwJXdI7ov7"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 transition"
            >
              <span>Open on YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Atmospheric Conditions & 7-Day Dawn Patrol Forecast */}
      {weather && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Weather and 7 Day forecast
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Sunrise className="w-3.5 h-3.5 text-amber-500" />
                Sunrise: <strong className="text-slate-800">{weather.daily?.sunrise?.[0]?.split("T")?.[1] || "06:25 AM"}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Sunset className="w-3.5 h-3.5 text-orange-500" />
                Sunset: <strong className="text-slate-800">{weather.daily?.sunset?.[0]?.split("T")?.[1] || "07:50 PM"}</strong>
              </span>
            </div>
          </div>

          {/* Current Atmosphere Highlights Bar */}
          {weather.current && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  <CloudSun className="w-3.5 h-3.5 text-sky-500" />
                  Air Temperature
                </div>
                <div className="text-xl font-mono font-light text-slate-900">
                  {formatTemp(weather.current.temperature_2m)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Feels like {formatTemp(weather.current.apparent_temperature)}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Wind className="w-3.5 h-3.5 text-sky-600" />
                  Wind Speed
                </div>
                <div className="text-xl font-mono font-light text-slate-900">
                  {formatWindSpeed(weather.current.wind_speed_10m)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-slate-400" />
                  Dir: {weather.current.wind_direction_10m ?? 0}°
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  Humidity
                </div>
                <div className="text-xl font-mono font-light text-slate-900">
                  {weather.current.relative_humidity_2m ?? 35}%
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Precip: {weather.current.precipitation ?? 0} in
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  UV Index
                </div>
                <div className="text-xl font-mono font-light text-amber-700">
                  {weather.current.uv_index ?? 5.5}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Moderate Solar
                </div>
              </div>
            </div>
          )}

          {/* 7-Day Forecast Grid */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              7-Day Daily Forecast
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
              {weather.daily?.temperature_2m_max?.map((maxTemp: number, i: number) => {
                const minTemp = weather.daily.temperature_2m_min[i];
                const dateStr = weather.daily.time[i];
                const dateObj = new Date(dateStr);
                const dayName = !isNaN(dateObj.getTime())
                  ? i === 0
                    ? "Today"
                    : dateObj.toLocaleDateString([], { weekday: "short" })
                  : `Day ${i + 1}`;
                const dayDate = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString([], { month: "numeric", day: "numeric" })
                  : "";

                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border flex flex-col justify-between items-center text-center ${
                      i === 0
                        ? "bg-sky-50/70 border-sky-300 ring-1 ring-sky-400"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-900 block text-sm">{dayName}</span>
                      <span className="text-[10px] text-slate-400">{dayDate}</span>
                    </div>

                    <Sun className={`w-6 h-6 my-2 ${i === 0 ? "text-amber-500" : "text-amber-400"}`} />

                    <div className="space-y-0.5">
                      <span className="text-sm font-bold text-slate-900 block font-mono">
                        {formatTemp(maxTemp)}
                      </span>
                      <span className="text-xs text-slate-500 block font-mono">
                        {formatTemp(minTemp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
