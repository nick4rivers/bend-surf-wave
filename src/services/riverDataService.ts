import { SurfDataResponse } from "../types";

// Helper for parsing CSV strings in client-side code
function parseCsvClient(csvText: string): Array<Record<string, string>> {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    records.push(row);
  }
  return records;
}

// EPA AQI calculation
function calculateEPAAqi(pm: number) {
  let aqi = 25;
  if (pm <= 12.0) {
    aqi = Math.round((50 / 12.0) * pm);
  } else if (pm <= 35.4) {
    aqi = Math.round(((100 - 51) / (35.4 - 12.1)) * (pm - 12.1) + 51);
  } else if (pm <= 55.4) {
    aqi = Math.round(((150 - 101) / (55.4 - 35.5)) * (pm - 35.5) + 101);
  } else if (pm <= 150.4) {
    aqi = Math.round(((200 - 151) / (150.4 - 55.5)) * (pm - 55.5) + 151);
  } else if (pm <= 250.4) {
    aqi = Math.round(((300 - 201) / (250.4 - 150.5)) * (pm - 150.5) + 201);
  } else {
    aqi = Math.round(((500 - 301) / (500.4 - 250.5)) * (pm - 250.5) + 301);
  }
  aqi = Math.max(0, Math.min(500, aqi));

  let rating = "Fresh";
  let category = "Good (0–50 AQI)";
  let color = "emerald";
  let description = "Pristine Cascade mountain air quality across Bend.";
  let recommendation = "Ideal conditions for high-exertion river surfing & paddling. Full lung capacity!";

  if (aqi <= 50) {
    rating = "Fresh";
    category = "Good (0–50 AQI)";
    color = "emerald";
    description = "Pristine Cascade mountain air quality across Bend.";
    recommendation = "Ideal conditions for high-exertion river surfing & paddling. Go get it!";
  } else if (aqi <= 100) {
    rating = "Moderate";
    category = "Moderate (51–100 AQI)";
    color = "amber";
    description = "Moderate air quality with noticeable background haze or particulate in the Deschutes basin.";
    recommendation = "Great for river surfing. Unusually sensitive individuals should monitor comfort.";
  } else if (aqi <= 150) {
    rating = "Sensitive Warning";
    category = "Sensitive Alert (101–150 AQI)";
    color = "orange";
    description = "Noticeable wildfire smoke drift settling over Bend.";
    recommendation = "Sensitive surfers & paddlers should shorten sessions and pace heavy cardio.";
  } else if (aqi <= 200) {
    rating = "Unhealthy";
    category = "Unhealthy (151–200 AQI)";
    color = "rose";
    description = "Active wildfire smoke layer settling over Bend & the river canyon.";
    recommendation = "General public may experience irritation. Limit high-intensity river sessions.";
  } else if (aqi <= 300) {
    rating = "Very Unhealthy";
    category = "Very Unhealthy (201–300 AQI)";
    color = "purple";
    description = "Dense wildfire smoke alert across Central Oregon.";
    recommendation = "Health alert: serious risk of respiratory irritation. Avoid intense outdoor exertion.";
  } else {
    rating = "Hazardous";
    category = "Hazardous (301+ AQI)";
    color = "maroon";
    description = "Emergency wildfire smoke conditions & severe inversion layer.";
    recommendation = "Hazardous health alert. Avoid outdoor activities and stay indoors.";
  }

  return { aqi, rating, category, color, description, recommendation };
}

/**
 * Browser-side fallback, used only when /api/surf-data can't be reached.
 *
 * The flow, canal, water-temperature and Wickiup data all come from USBR Hydromet, which
 * can't be fetched from a browser (no CORS), so in this mode those readings are reported as
 * unavailable rather than invented. Weather and air quality come from Open-Meteo, which can.
 */
export async function fetchSurfDataClientSide(): Promise<SurfDataResponse> {
  console.info("Executing client-side fallback fetch (weather and air quality only)...");

  const getJson = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = (await r.text()).trim();
    if (!text.startsWith("{") && !text.startsWith("[")) throw new Error("Non-JSON response");
    return JSON.parse(text);
  };

  const [weatherRes, airRes] = await Promise.allSettled([
    getJson("https://api.open-meteo.com/v1/forecast?latitude=44.0582&longitude=-121.3153&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FLos_Angeles&past_days=92&forecast_days=7"),
    getJson("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.0504&longitude=-121.3216&current=us_aqi,pm2_5,pm10,ozone,carbon_monoxide&timezone=America%2FLos_Angeles"),
  ]);

  let weather: any = null;
  let airTempF: number | null = null;
  if (weatherRes.status === "fulfilled" && weatherRes.value) {
    weather = weatherRes.value;
    if (typeof weather?.current?.temperature_2m === "number") airTempF = weather.current.temperature_2m;
    if (Array.isArray(weather?.daily?.time) && weather.daily.time.length > 7) {
      const n = 7;
      weather.daily = {
        time: weather.daily.time.slice(-n),
        temperature_2m_max: weather.daily.temperature_2m_max?.slice(-n) || [],
        temperature_2m_min: weather.daily.temperature_2m_min?.slice(-n) || [],
        weather_code: weather.daily.weather_code?.slice(-n) || [],
        sunrise: weather.daily.sunrise?.slice(-n) || [],
        sunset: weather.daily.sunset?.slice(-n) || [],
      };
    }
  }

  let airQuality: SurfDataResponse["airQuality"] = undefined;
  const pm = airRes.status === "fulfilled" ? airRes.value?.current?.pm2_5 : undefined;
  if (typeof pm === "number") {
    const cur = airRes.status === "fulfilled" ? airRes.value.current : {};
    airQuality = {
      ...calculateEPAAqi(pm),
      pm2_5: parseFloat(pm.toFixed(1)),
      pm10: typeof cur.pm10 === "number" ? cur.pm10 : undefined,
      ozone: typeof cur.ozone === "number" ? cur.ozone : undefined,
      updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      source: "Open-Meteo air quality model (Bend, OR)",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      sensorName: "Open-Meteo model",
      distance: "Bend, OR",
    };
  }

  const down = {
    available: false,
    stale: false,
    lastReading: null,
    message: "The site's data server isn't responding, so live USBR gage readings are unavailable right now.",
  };

  return {
    spotName: "Bend Whitewater Park - Surf Wave",
    riverName: "Deschutes River, Bend, Oregon",
    coordinates: { lat: 44.0504, lng: -121.3216 },
    lastUpdated: "",
    dataStatus: { flow: { ...down }, waterTemp: { ...down }, wickiup: { ...down } },
    current: {
      flowCfs: null,
      waterTempF: null,
      waterTempC: null,
      waterTempStation: "BENO (Benham Falls, ~20 river km upstream)",
      airTempF,
      airTempC: airTempF === null ? null : parseFloat((((airTempF - 32) * 5) / 9).toFixed(1)),
      statusRating: "UNAVAILABLE",
      statusLabel: "No Data",
      statusColor: "slate",
      statusDescription: down.message,
      wetsuitRec: null,
      flowTrendDiff: null,
      thresholds: { awesome: 800, surfTime: 650, skimShortFins: 550 },
    },
    upstreamGages: null,
    timeSeries: { flow: [], temperature: [], canals: [], historical: [] },
    usgsGages: {},
    weather,
    airQuality,
    webcams: [
      {
        id: "bend-park-cam",
        title: "Bend Whitewater Park Live Cam",
        location: "Colorado Dam & Surf Wave, Bend, OR (Thanks to The Bend Bulletin)",
        // Browser-only fallback (API unreachable): The Bulletin channel's current live stream.
        embedUrl: "https://www.youtube.com/embed/live_stream?channel=UC5NGBccFc9inD-62NMKGtVg",
        watchUrl: "https://www.youtube.com/@bendbulletin/streams",
        channelUrl: "https://www.youtube.com/@bendbulletin/streams",
        isLive: null,
      },
    ],
    wickiupStorage: undefined,
  };
}

function cleanSurfData(data: SurfDataResponse): SurfDataResponse {
  if (!data) return data;
  if (data.airQuality) {
    if (typeof data.airQuality.rating === "string") {
      data.airQuality.rating = data.airQuality.rating.replace(/fresh af/gi, "Fresh").trim();
    }
    if (typeof data.airQuality.category === "string") {
      data.airQuality.category = data.airQuality.category.replace(/fresh af/gi, "Fresh");
    }
    if (typeof data.airQuality.description === "string") {
      data.airQuality.description = data.airQuality.description.replace(/fresh af/gi, "Fresh");
    }
  }
  return data;
}

/**
 * Universal Surf Data Fetcher:
 * 1. Calls the /api/surf-data endpoint (works with Vercel serverless function & local Express server).
 * 2. If /api/surf-data responds with 404 (or errors on static hosts), automatically fails over
 *    to direct client-side fetching so the user interface never breaks with a 404.
 */
export async function getSurfReport(): Promise<SurfDataResponse> {
  try {
    const res = await fetch("/api/surf-data");
    if (res.ok) {
      const json = await res.json();
      return cleanSurfData(json);
    }
    console.warn(`/api/surf-data returned status ${res.status}. Failing over to direct client-side fetch.`);
  } catch (err) {
    console.warn("Error reaching /api/surf-data. Failing over to direct client-side fetch.", err);
  }

  // Graceful client-side fallback
  const fallback = await fetchSurfDataClientSide();
  return cleanSurfData(fallback);
}
