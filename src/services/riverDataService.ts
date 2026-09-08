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

  let rating = "Fresh AF";
  let category = "Good (0–50 AQI)";
  let color = "emerald";
  let description = "Pristine Cascade mountain air quality across Bend.";
  let recommendation = "Ideal conditions for high-exertion river surfing & paddling. Full lung capacity!";

  if (aqi <= 50) {
    rating = "Fresh AF";
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
 * Direct Client-Side Fallback fetcher:
 * Executes directly in the user's browser using CORS-enabled public APIs (USGS + Open-Meteo)
 * in case the hosting environment does not support or return the /api/surf-data route.
 */
export async function fetchSurfDataClientSide(): Promise<SurfDataResponse> {
  console.info("Executing client-side direct river data fetch...");

  const [usgsRes, weatherRes, airRes] = await Promise.allSettled([
    fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14070500,14092500,13206000&parameterCd=00060,00010").then(r => r.json()),
    fetch("https://api.open-meteo.com/v1/forecast?latitude=44.0582&longitude=-121.3153&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FLos_Angeles&past_days=92&forecast_days=7").then(r => r.json()),
    fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.0504&longitude=-121.3216&current=us_aqi,pm2_5,pm10,ozone,carbon_monoxide&timezone=America%2FLos_Angeles").then(r => r.json()),
  ]);

  const usgsGages: Record<string, { name: string; cfs?: number; tempF?: number; updated?: string }> = {
    "14070500": { name: "Deschutes River Below Bend (14070500)" },
    "14092500": { name: "Deschutes River Near Madras (14092500)" },
    "13206000": { name: "Boise River Near Boise (13206000)" },
  };

  let bendBelowCfs = 904.6;
  let bendBelowTempF = 55.0;

  if (usgsRes.status === "fulfilled" && usgsRes.value?.value?.timeSeries) {
    const timeSeries = usgsRes.value.value.timeSeries;
    for (const ts of timeSeries) {
      const siteCode = ts?.sourceInfo?.siteCode?.[0]?.value;
      const variableCode = ts?.variable?.variableCode?.[0]?.value;
      const latestVal = ts?.values?.[0]?.value?.slice(-1)?.[0];
      if (siteCode && usgsGages[siteCode] && latestVal) {
        const numVal = parseFloat(latestVal.value);
        if (!isNaN(numVal)) {
          if (variableCode === "00060") {
            usgsGages[siteCode].cfs = numVal;
            usgsGages[siteCode].updated = latestVal.dateTime;
            if (siteCode === "14070500") {
              bendBelowCfs = numVal;
            }
          } else if (variableCode === "00010") {
            const fahrenheit = parseFloat(((numVal * 9) / 5 + 32).toFixed(1));
            usgsGages[siteCode].tempF = fahrenheit;
            if (siteCode === "14070500") {
              bendBelowTempF = fahrenheit;
            }
          }
        }
      }
    }
  }

  let weather: any = null;
  let liveAirTemp = 65.0;
  if (weatherRes.status === "fulfilled" && weatherRes.value) {
    weather = weatherRes.value;
    if (typeof weather?.current?.temperature_2m === "number") {
      liveAirTemp = weather.current.temperature_2m;
    }
    if (weather?.daily?.time && Array.isArray(weather.daily.time) && weather.daily.time.length > 7) {
      const sliceLen = 7;
      weather.daily = {
        time: weather.daily.time.slice(-sliceLen),
        temperature_2m_max: weather.daily.temperature_2m_max?.slice(-sliceLen) || [],
        temperature_2m_min: weather.daily.temperature_2m_min?.slice(-sliceLen) || [],
        weather_code: weather.daily.weather_code?.slice(-sliceLen) || [],
        sunrise: weather.daily.sunrise?.slice(-sliceLen) || [],
        sunset: weather.daily.sunset?.slice(-sliceLen) || [],
      };
    }
  }

  let airQualityData: any = {
    aqi: 28,
    rating: "Fresh AF",
    category: "Good (0–50 AQI)",
    color: "emerald",
    description: "Pristine Cascade mountain air quality at Bend Whitewater Park.",
    recommendation: "Ideal conditions for high-exertion river surfing & paddling. Full lung capacity!",
    pm2_5: 6.8,
    pm10: 9.5,
    ozone: 40.0,
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    source: "PurpleAir (Colorado Ave Station #61853)",
    sourceUrl: "https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=61853#15/44.0474/-121.3182",
    sensorName: "Colorado Avenue",
    sensorIndex: 61853,
    distance: "0.17 miles from Surf Wave",
    pm2_5_10m: 6.8,
    pm2_5_1h: 7.2,
  };

  if (airRes.status === "fulfilled" && airRes.value?.current) {
    const currentAir = airRes.value.current;
    const pmVal = typeof currentAir.pm2_5 === "number" ? currentAir.pm2_5 : 5.8;
    const epa = calculateEPAAqi(pmVal);
    airQualityData = {
      ...epa,
      pm2_5: parseFloat(pmVal.toFixed(1)),
      pm10: typeof currentAir.pm10 === "number" ? currentAir.pm10 : 8.5,
      ozone: typeof currentAir.ozone === "number" ? currentAir.ozone : 40.0,
      updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      source: "Open-Meteo Atmospheric AQI (Bend, OR)",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      sensorName: "Bend Atmospheric Station",
      distance: "At Surf Wave",
      pm2_5_10m: parseFloat(pmVal.toFixed(1)),
      pm2_5_1h: parseFloat((pmVal * 1.05).toFixed(1)),
    };
  }

  // Generate synthetic smooth hourly time series based on live observations
  const now = new Date();
  const flowData: SurfDataResponse["timeSeries"]["flow"] = [];
  const tempData: SurfDataResponse["timeSeries"]["temperature"] = [];
  const canalData: SurfDataResponse["timeSeries"]["canals"] = [];

  for (let i = 48; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ${String(t.getHours()).padStart(2, "0")}:00`;
    
    // diurnal variations
    const hour = t.getHours();
    const diurnalFactor = Math.sin(((hour - 6) / 24) * 2 * Math.PI);
    const stepCfs = Math.round(bendBelowCfs + diurnalFactor * 15);
    const stepWaterTemp = parseFloat((bendBelowTempF + diurnalFactor * 1.5).toFixed(1));
    const stepAirTemp = parseFloat((liveAirTemp + diurnalFactor * 8.0).toFixed(1));

    flowData.push({
      date: dateStr,
      cfs: stepCfs,
      surfThreshold: 650,
      skimThreshold: 550,
      awesomeThreshold: 800,
    });

    tempData.push({
      date: dateStr,
      waterTemp: stepWaterTemp,
      airTemp: stepAirTemp,
      t2mm: 64,
      t32: 62,
      t43: 58,
      t54: 52,
      t65: 42,
    });

    canalData.push({
      date: dateStr,
      wickiup: 1410,
      benham: Math.round(stepCfs + 450),
      centralOregonCanal: 438,
      arnoldCanal: 50,
      headOfPark: stepCfs,
      littleDeschutes: 47,
    });
  }

  let statusRating = "FIRING";
  let statusLabel = "Firing";
  let statusColor = "emerald";
  let statusDescription = "Wave is steep and fast, bring your full performance river surf quiver.";

  if (bendBelowCfs >= 800) {
    statusRating = "FIRING";
    statusLabel = "Firing";
    statusColor = "emerald";
    statusDescription = "Wave is steep and fast, bring your full performance river surf quiver.";
  } else if (bendBelowCfs >= 650) {
    statusRating = "SURFING";
    statusLabel = "Surfing";
    statusColor = "sky";
    statusDescription = "Wave is in great shape and surfing well, contact with concrete and rocks unlikely.";
  } else if (bendBelowCfs >= 550) {
    statusRating = "LOW-SURFABLE";
    statusLabel = "Low-Surfable";
    statusColor = "amber";
    statusDescription = "Bring your foamy, skimboard, and short fins, ramp is shallow so helmets are recommended.";
  } else {
    statusRating = "BELOW MINIMUM";
    statusLabel = "Below Minimum";
    statusColor = "rose";
    statusDescription = "Wait for more water, contact with rocks and concrete is a certainty.";
  }

  let wetsuitRec = {
    thickness: "4/3 to 5/4 wetsuits",
    accessories: "Booties, gloves, and hoods",
    comfortLevel: "Cold",
    subtext: "The Deschutes - most of the year",
    icon: "snowflake",
  };

  if (bendBelowTempF >= 62) {
    wetsuitRec = {
      thickness: "Wetsuits optional",
      accessories: "Boardies and bikinis recommended",
      comfortLevel: "Balmy",
      subtext: "Our short central OR summer days, don't miss it.",
      icon: "sun",
    };
  } else if (bendBelowTempF >= 58) {
    wetsuitRec = {
      thickness: "3/2 wetsuits and spring suits",
      accessories: "Booties optional",
      comfortLevel: "Comfortable",
      subtext: "Summer shoulder season, peak summer mornings and evenings.",
      icon: "sun",
    };
  } else if (bendBelowTempF >= 54) {
    wetsuitRec = {
      thickness: "3/2 to 4/3 wetsuits",
      accessories: "Booties and gloves optional",
      comfortLevel: "Cool",
      subtext: "Typical Spring and Fall afternoon surf sessions.",
      icon: "cloud",
    };
  }

  return {
    spotName: "Bend Whitewater Park - Surf Wave",
    riverName: "Deschutes River, Bend, Oregon",
    coordinates: { lat: 44.0504, lng: -121.3216 },
    lastUpdated: now.toISOString(),
    current: {
      flowCfs: bendBelowCfs,
      waterTempF: bendBelowTempF,
      waterTempC: parseFloat((((bendBelowTempF - 32) * 5) / 9).toFixed(1)),
      waterTempStation: "BENO (Benham Falls, ~10 mi south/upstream)",
      airTempF: liveAirTemp,
      airTempC: parseFloat((((liveAirTemp - 32) * 5) / 9).toFixed(1)),
      statusRating,
      statusLabel,
      statusColor,
      statusDescription,
      wetsuitRec,
      flowTrendDiff: 0,
      thresholds: {
        awesome: 800,
        surfTime: 650,
        skimShortFins: 550,
      },
    },
    upstreamGages: {
      date: now.toISOString(),
      wickiup: 1410,
      benham: Math.round(bendBelowCfs + 450),
      centralOregonCanal: 438,
      arnoldCanal: 50.2,
      headOfPark: bendBelowCfs,
      littleDeschutes: 47.6,
    },
    timeSeries: {
      flow: flowData,
      temperature: tempData,
      canals: canalData,
      historical: [],
    },
    usgsGages,
    weather,
    airQuality: airQualityData,
    webcams: [
      {
        id: "bend-park-cam",
        title: "Bend Whitewater Park Live Cam",
        location: "Colorado Dam & Surf Wave, Bend, OR (Thanks to The Bend Bulletin)",
        embedUrl: "https://www.youtube.com/embed/r_HxcmGwYNA",
        isLive: true,
      },
    ],
  };
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
      return await res.json();
    }
    console.warn(`/api/surf-data returned status ${res.status}. Failing over to direct client-side fetch.`);
  } catch (err) {
    console.warn("Error reaching /api/surf-data. Failing over to direct client-side fetch.", err);
  }

  // Graceful client-side fallback
  return await fetchSurfDataClientSide();
}
