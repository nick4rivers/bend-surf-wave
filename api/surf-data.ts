import https from "https";
import http from "http";
import type { SurfDataResponse } from "../src/types";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<any>> = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

export function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BendSurfWave/2.0; +https://bendsurfwave.com)",
          Accept: "*/*",
        },
        timeout: 10000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// Parse CSV text into arrays of objects
export function parseCsv(csvText: string): Array<Record<string, string>> {
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

// EPA standard AQI converter from PM2.5 (µg/m³)
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

export async function getSurfReportData(): Promise<SurfDataResponse> {
  const cacheKey = "surf_report_master_data";
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
    return cache[cacheKey].data;
  }

  // Parallel fetch from data sources
  const [
    greenwaveYearCsv,
    tempCsv,
    multiYearCsv,
    canalCsv,
    whitewaterCsv,
    usgsJson,
    openMeteoWeatherJson,
    purpleAirMapJson,
    openMeteoAirJson,
    usbrBenoWfHtml,
  ] = await Promise.allSettled([
    fetchUrl("https://rmmanalytics.com/Lleds_Water_Levels/GREENWAVE_Year.csv"),
    fetchUrl("https://rmmanalytics.com/Lleds_Water_Levels/BENOWaterAirTemp.csv"),
    fetchUrl("https://rmmanalytics.com/Lleds_Water_Levels/GREENWAVE_13to20Year.csv"),
    fetchUrl("https://rmmanalytics.com/Lleds_Water_Levels/WICO_BENO_CENO_ARNO_HEAD_LAPO.csv"),
    fetchUrl("https://rmmanalytics.com/Lleds_Water_Levels/WICO-BENO-Whitewater.csv"),
    fetchUrl("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14070500,14092500,13206000&parameterCd=00060,00010"),
    fetchUrl("https://api.open-meteo.com/v1/forecast?latitude=44.0582&longitude=-121.3153&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FLos_Angeles&past_days=92&forecast_days=7"),
    process.env.PURPLE_AIR_API_KEY
      ? fetchUrl(`https://api.purpleair.com/v1/sensors/61853?api_key=${process.env.PURPLE_AIR_API_KEY}`)
      : fetchUrl("https://map.purpleair.com/data.json?opt=1/m/i/pm25_10m/a10/c0&box=44.00,-121.36,44.10,-121.26"),
    fetchUrl("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.0504&longitude=-121.3216&current=us_aqi,pm2_5,pm10,ozone,carbon_monoxide&timezone=America%2FLos_Angeles"),
    fetchUrl("https://www.usbr.gov/pn-bin/v1/instant.pl?list=beno%20wf&back=480&format=dfcgi"),
  ]);

  // Parse Weather from Open-Meteo (Bend, Oregon in America/Los_Angeles local time)
  let weather: any = null;
  const openMeteoHourlyMap: Record<string, number> = {};
  if (openMeteoWeatherJson.status === "fulfilled" && openMeteoWeatherJson.value) {
    try {
      const rawWeather = JSON.parse(openMeteoWeatherJson.value);
      if (rawWeather?.hourly?.time && Array.isArray(rawWeather.hourly.time) && Array.isArray(rawWeather.hourly.temperature_2m)) {
        rawWeather.hourly.time.forEach((tStr: string, idx: number) => {
          const tempVal = rawWeather.hourly.temperature_2m[idx];
          if (typeof tempVal === "number" && !isNaN(tempVal)) {
            const withSpace = tStr.replace("T", " ");
            openMeteoHourlyMap[withSpace] = tempVal;
            openMeteoHourlyMap[tStr] = tempVal;
            const normalized = withSpace.substring(0, 16);
            openMeteoHourlyMap[normalized] = tempVal;
          }
        });
      }

      weather = { ...rawWeather };
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
    } catch (err) {
      console.error("Error parsing weather json:", err);
    }
  }

  const liveAirFromWeather = typeof weather?.current?.temperature_2m === "number" && !isNaN(weather.current.temperature_2m)
    ? weather.current.temperature_2m
    : null;

  // Parse Flow CSV
  let flowData: Array<{
    date: string;
    cfs: number;
    surfThreshold: number;
    skimThreshold: number;
    awesomeThreshold: number;
  }> = [];

  if (greenwaveYearCsv.status === "fulfilled" && greenwaveYearCsv.value) {
    const parsed = parseCsv(greenwaveYearCsv.value);
    flowData = parsed.map((row) => {
      const date = row["Date"] || "";
      const cfs = parseFloat(row["CFS @ Head of Park"] || "0");
      const surfThreshold = parseFloat(row["Surf-Time!! Be very light on your feet"] || "650");
      const skimThreshold = parseFloat(row["Skimboards or short fins!"] || "550");
      const awesomeThreshold = parseFloat(row["AWESOME Wave Time"] || "800");
      return {
        date,
        cfs: isNaN(cfs) ? 0 : cfs,
        surfThreshold: isNaN(surfThreshold) ? 650 : surfThreshold,
        skimThreshold: isNaN(skimThreshold) ? 550 : skimThreshold,
        awesomeThreshold: isNaN(awesomeThreshold) ? 800 : awesomeThreshold,
      };
    }).filter(r => r.date && r.cfs > 0);
  }

  // Augment flowData with complete 365-day historical daily values for Full Year range
  if (multiYearCsv.status === "fulfilled" && multiYearCsv.value && flowData.length > 0) {
    const parsedMulti = parseCsv(multiYearCsv.value);
    const dailyLookup: Record<string, number> = {};

    parsedMulti.forEach((row) => {
      const dStr = row["Date"] || "";
      const cleanD = dStr.split(" ")[0] || "";
      const mmdd = cleanD.substring(5); // "01-01"
      const cfs2024 = parseFloat(row["2024"] || row["2023"] || "0");
      if (mmdd && !isNaN(cfs2024) && cfs2024 > 0) {
        dailyLookup[mmdd] = cfs2024;
      }
    });

    const firstRecentDateStr = flowData[0].date;
    const lastRecentDateStr = flowData[flowData.length - 1].date;
    const firstRecentDate = new Date(firstRecentDateStr.replace(/-/g, "/"));
    const latestDate = new Date(lastRecentDateStr.replace(/-/g, "/"));

    if (!isNaN(firstRecentDate.getTime()) && !isNaN(latestDate.getTime())) {
      const fullYearHistory: typeof flowData = [];
      const startDate = new Date(latestDate);
      startDate.setDate(startDate.getDate() - 365);

      let cur = new Date(startDate);
      while (cur < firstRecentDate) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const mmdd = `${mm}-${dd}`;
        const cfs = dailyLookup[mmdd] || (cur.getMonth() >= 4 && cur.getMonth() <= 8 ? 880 : 480);

        fullYearHistory.push({
          date: `${yyyy}-${mm}-${dd} 12:00`,
          cfs,
          surfThreshold: 650,
          skimThreshold: 550,
          awesomeThreshold: 800,
        });
        cur.setDate(cur.getDate() + 1);
      }

      flowData = [...fullYearHistory, ...flowData];
    }
  }

  // Parse Real-Time USBR Hydromet BENO Water Temperature (15-min sensor observations from Benham Falls, ~10 mi upstream)
  const benoRealWaterMap: Record<string, number> = {};
  const benoRealHourlyMap: Record<string, number> = {};
  const benoRealWaterList: Array<{ date: string; waterTemp: number }> = [];

  if (usbrBenoWfHtml.status === "fulfilled" && usbrBenoWfHtml.value) {
    const tableRows = [
      ...usbrBenoWfHtml.value.matchAll(/<tr><td>(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})<\/td><td>([\d.-]+)<\/td><\/tr>/g),
    ];
    for (const match of tableRows) {
      const dtStr = match[1]; // e.g. "2026-09-06 10:30"
      const celsius = parseFloat(match[2]);
      if (!isNaN(celsius) && celsius > -5 && celsius < 45) {
        const fahrenheit = parseFloat(((celsius * 9) / 5 + 32).toFixed(1));
        benoRealWaterMap[dtStr] = fahrenheit;
        const hourPrefix = dtStr.substring(0, 13);
        benoRealHourlyMap[`${hourPrefix}:00`] = fahrenheit;
        benoRealWaterList.push({ date: dtStr, waterTemp: fahrenheit });
      }
    }
  }

  // Parse Temp CSV
  let tempData: Array<{
    date: string;
    waterTemp: number;
    airTemp: number;
    t2mm: number;
    t32: number;
    t43: number;
    t54: number;
    t65: number;
  }> = [];

  if (tempCsv.status === "fulfilled" && tempCsv.value) {
    const parsed = parseCsv(tempCsv.value);
    tempData = parsed.map((row) => {
      const date = row["Date"] || "";
      const rawWaterTemp = parseFloat(row["WATER_TEMP"] || "0");
      const rawCsvAirTemp = parseFloat(row["Air-Temp"] || "0");
      const t2mm = parseFloat(row["2mm Top/ Shorty/ Spring/ Skin"] || "64");
      const t32 = parseFloat(row["2-3/2 Springsuit--FullSuit"] || "62");
      const t43 = parseFloat(row["___3/2---4/3 Full Wetsuit  and  Boots"] || "58");
      const t54 = parseFloat(row["4/3-5/4FullSuit_Boots_Gloves_Hood"] || "52");
      const t65 = parseFloat(row["6/5FullSuit_Boots_Gloves_Hood"] || "42");

      const hourMatch = date.match(/[\sT](\d{1,2}):/);
      const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;

      const cleanDateKey = date.trim();
      const datePrefix = cleanDateKey.substring(0, 16);
      const hourKey = cleanDateKey.substring(0, 13) + ":00";
      let resolvedAirTemp: number;

      if (openMeteoHourlyMap[cleanDateKey] !== undefined) {
        resolvedAirTemp = openMeteoHourlyMap[cleanDateKey];
      } else if (openMeteoHourlyMap[datePrefix] !== undefined) {
        resolvedAirTemp = openMeteoHourlyMap[datePrefix];
      } else {
        const baseAir = !isNaN(rawCsvAirTemp) && rawCsvAirTemp > 0 ? rawCsvAirTemp : 62;
        const airDiurnalRad = ((hour - 6.0) / 24) * 2 * Math.PI - Math.PI / 2;
        const airDiurnalFactor = Math.sin(airDiurnalRad);
        resolvedAirTemp = parseFloat((baseAir + airDiurnalFactor * 13.5).toFixed(1));
      }

      let waterTemp: number;
      if (benoRealWaterMap[cleanDateKey] !== undefined) {
        waterTemp = benoRealWaterMap[cleanDateKey];
      } else if (benoRealWaterMap[datePrefix] !== undefined) {
        waterTemp = benoRealWaterMap[datePrefix];
      } else if (benoRealHourlyMap[hourKey] !== undefined) {
        waterTemp = benoRealHourlyMap[hourKey];
      } else {
        waterTemp = !isNaN(rawWaterTemp) && rawWaterTemp > 0 ? rawWaterTemp : 58.0;
      }

      return {
        date,
        waterTemp,
        airTemp: resolvedAirTemp,
        t2mm,
        t32,
        t43,
        t54,
        t65,
      };
    }).filter(r => r.date && r.waterTemp > 0);

    // Append any newer hours from the live USBR BENO stream gauge that post-date the CSV
    if (benoRealWaterList.length > 0 && tempData.length > 0) {
      const lastTempDate = tempData[tempData.length - 1].date;
      const newerHourKeys = Object.keys(benoRealHourlyMap)
        .filter((k) => k > lastTempDate)
        .sort();

      for (const hourKey of newerHourKeys) {
        const waterT = benoRealHourlyMap[hourKey];
        const airT = openMeteoHourlyMap[hourKey] ?? liveAirFromWeather ?? 65.0;
        tempData.push({
          date: hourKey,
          waterTemp: waterT,
          airTemp: airT,
          t2mm: 64,
          t32: 62,
          t43: 58,
          t54: 52,
          t65: 42,
        });
      }
    }
  }

  // Parse Canal / Multi-gage CSV
  let canalData: Array<{
    date: string;
    wickiup: number;
    benham: number;
    centralOregonCanal: number;
    arnoldCanal: number;
    headOfPark: number;
    littleDeschutes: number;
  }> = [];

  if (canalCsv.status === "fulfilled" && canalCsv.value) {
    const parsed = parseCsv(canalCsv.value);
    canalData = parsed.map((row) => ({
      date: row["Date"] || "",
      wickiup: parseFloat(row["below_Wickiup_Res"] || "0") || 0,
      benham: parseFloat(row["BENO"] || "0") || 0,
      centralOregonCanal: parseFloat(row["CENO"] || "0") || 0,
      arnoldCanal: parseFloat(row["ARNO"] || "0") || 0,
      headOfPark: parseFloat(row["HeadOfPark"] || "0") || 0,
      littleDeschutes: parseFloat(row["LAPO"] || "0") || 0,
    })).filter(r => r.date);
  }

  // Parse Multi-Year Historical CSV
  let historicalData: Array<Record<string, any>> = [];
  if (multiYearCsv.status === "fulfilled" && multiYearCsv.value) {
    historicalData = parseCsv(multiYearCsv.value).map((row) => {
      const item: Record<string, any> = { date: row["Date"] };
      Object.keys(row).forEach((k) => {
        if (k !== "Date") {
          const val = parseFloat(row[k]);
          item[k] = isNaN(val) ? null : val;
        }
      });
      return item;
    });
  }

  // Parse USGS Real-time Gages
  const usgsGages: Record<string, { name: string; cfs?: number; tempF?: number; updated?: string }> = {
    "14070500": { name: "Deschutes River Below Bend (14070500)" },
    "14092500": { name: "Deschutes River Near Madras (14092500)" },
    "13206000": { name: "Boise River Near Boise (13206000)" },
  };

  if (usgsJson.status === "fulfilled" && usgsJson.value) {
    try {
      const json = JSON.parse(usgsJson.value);
      const timeSeries = json?.value?.timeSeries || [];
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
            } else if (variableCode === "00010") {
              usgsGages[siteCode].tempF = parseFloat(((numVal * 9) / 5 + 32).toFixed(1));
            }
          }
        }
      }
    } catch (err) {
      console.error("Error parsing USGS json:", err);
    }
  }

  // Latest readings calculation
  const latestFlow = flowData.slice(-1)[0] || {
    date: new Date().toISOString(),
    cfs: 904.6,
    surfThreshold: 650,
    skimThreshold: 550,
    awesomeThreshold: 800,
  };

  const latestTemp = tempData.slice(-1)[0] || {
    date: new Date().toISOString(),
    waterTemp: 59.1,
    airTemp: liveAirFromWeather ?? 68.0,
    t2mm: 64,
    t32: 62,
    t43: 58,
    t54: 52,
    t65: 42,
  };

  if (benoRealWaterList.length > 0) {
    const latestBenoReading = benoRealWaterList[benoRealWaterList.length - 1];
    latestTemp.waterTemp = latestBenoReading.waterTemp;
    latestTemp.date = latestBenoReading.date;
  }

  if (liveAirFromWeather !== null) {
    latestTemp.airTemp = liveAirFromWeather;
  }

  const latestCanal = canalData.slice(-1)[0] || {
    date: new Date().toISOString(),
    wickiup: 1410,
    benham: 1510,
    centralOregonCanal: 438,
    arnoldCanal: 50.2,
    headOfPark: 904.6,
    littleDeschutes: 47.6,
  };

  let statusRating = "FIRING";
  let statusLabel = "Firing";
  let statusColor = "emerald";
  let statusDescription = "Wave is steep and fast, bring your full performance river surf quiver.";

  if (latestFlow.cfs >= 800) {
    statusRating = "FIRING";
    statusLabel = "Firing";
    statusColor = "emerald";
    statusDescription = "Wave is steep and fast, bring your full performance river surf quiver.";
  } else if (latestFlow.cfs >= 650) {
    statusRating = "SURFING";
    statusLabel = "Surfing";
    statusColor = "sky";
    statusDescription = "Wave is in great shape and surfing well, contact with concrete and rocks unlikely.";
  } else if (latestFlow.cfs >= 550) {
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

  const wTemp = latestTemp.waterTemp;
  if (wTemp >= 62) {
    wetsuitRec = {
      thickness: "Wetsuits optional",
      accessories: "Boardies and bikinis recommended",
      comfortLevel: "Balmy",
      subtext: "Our short central OR summer days, don't miss it.",
      icon: "sun",
    };
  } else if (wTemp >= 58) {
    wetsuitRec = {
      thickness: "3/2 wetsuits and spring suits",
      accessories: "Booties optional",
      comfortLevel: "Comfortable",
      subtext: "Summer shoulder season, peak summer mornings and evenings.",
      icon: "sun",
    };
  } else if (wTemp >= 54) {
    wetsuitRec = {
      thickness: "3/2 to 4/3 wetsuits",
      accessories: "Booties and gloves optional",
      comfortLevel: "Cool",
      subtext: "Typical Spring and Fall afternoon surf sessions.",
      icon: "cloud",
    };
  } else {
    wetsuitRec = {
      thickness: "4/3 to 5/4 wetsuits",
      accessories: "Booties, gloves, and hoods",
      comfortLevel: "Cold",
      subtext: "The Deschutes - most of the year",
      icon: "snowflake",
    };
  }

  const recent24hFlows = flowData.slice(-96);
  const flowTrendDiff = recent24hFlows.length > 4
    ? latestFlow.cfs - recent24hFlows[0].cfs
    : 0;

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

  let parsedFromPurpleAir = false;

  if (purpleAirMapJson.status === "fulfilled" && purpleAirMapJson.value) {
    try {
      const text = purpleAirMapJson.value;
      if (text.startsWith("{")) {
        const parsed = JSON.parse(text);
        if (parsed.sensor) {
          const s = parsed.sensor;
          const pmVal = typeof s["pm2.5_10minute"] === "number" ? s["pm2.5_10minute"]
            : typeof s["pm2.5"] === "number" ? s["pm2.5"]
            : typeof s["pm2.5_atm"] === "number" ? s["pm2.5_atm"] : null;
          if (pmVal !== null) {
            const epa = calculateEPAAqi(pmVal);
            airQualityData = {
              ...epa,
              pm2_5: parseFloat(pmVal.toFixed(1)),
              pm10: parseFloat((pmVal * 1.4).toFixed(1)),
              ozone: 40.0,
              updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              source: "PurpleAir (Colorado Ave Station #61853)",
              sourceUrl: "https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=61853#15/44.0474/-121.3182",
              sensorName: s.name || "Colorado Avenue",
              sensorIndex: s.sensor_index || 61853,
              distance: "0.17 miles from Surf Wave",
              pm2_5_10m: parseFloat(pmVal.toFixed(1)),
              pm2_5_1h: typeof s["pm2.5_60minute"] === "number" ? parseFloat(s["pm2.5_60minute"].toFixed(1)) : parseFloat(pmVal.toFixed(1)),
            };
            parsedFromPurpleAir = true;
          }
        } else if (Array.isArray(parsed.fields) && Array.isArray(parsed.data)) {
          const idxIndex = parsed.fields.indexOf("sensor_index");
          const pm10mIdx = parsed.fields.indexOf("pm2.5_10minute");
          const pmAtmIdx = parsed.fields.indexOf("pm2.5_atm");
          const nameIdx = parsed.fields.indexOf("name");

          let targetRow = parsed.data.find((row: any[]) => row[idxIndex] === 61853);
          if (!targetRow && parsed.data.length > 0) {
            targetRow = parsed.data[0];
          }

          if (targetRow) {
            const pmVal = (pm10mIdx !== -1 && typeof targetRow[pm10mIdx] === "number")
              ? targetRow[pm10mIdx]
              : (pmAtmIdx !== -1 && typeof targetRow[pmAtmIdx] === "number")
              ? targetRow[pmAtmIdx]
              : null;
            if (pmVal !== null) {
              const epa = calculateEPAAqi(pmVal);
              const sName = (nameIdx !== -1 && targetRow[nameIdx]) ? targetRow[nameIdx] : "Colorado Avenue";
              const sIdx = (idxIndex !== -1 && targetRow[idxIndex]) ? targetRow[idxIndex] : 61853;
              airQualityData = {
                ...epa,
                pm2_5: parseFloat(pmVal.toFixed(1)),
                pm10: parseFloat((pmVal * 1.4).toFixed(1)),
                ozone: 40.0,
                updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
                source: `PurpleAir (${sName} #${sIdx})`,
                sourceUrl: `https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=${sIdx}#15/44.0474/-121.3182`,
                sensorName: sName,
                sensorIndex: sIdx,
                distance: "0.17 miles from Surf Wave",
                pm2_5_10m: parseFloat(pmVal.toFixed(1)),
              };
              parsedFromPurpleAir = true;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error parsing PurpleAir JSON:", err);
    }
  }

  if (!parsedFromPurpleAir && openMeteoAirJson.status === "fulfilled" && openMeteoAirJson.value) {
    try {
      const aq = JSON.parse(openMeteoAirJson.value);
      const pmVal = typeof aq?.current?.pm2_5 === "number" ? aq.current.pm2_5 : 5.2;
      const pm10 = typeof aq?.current?.pm10 === "number" ? parseFloat(aq.current.pm10.toFixed(1)) : 8.0;
      const ozone = typeof aq?.current?.ozone === "number" ? parseFloat(aq.current.ozone.toFixed(1)) : 82.0;

      const epa = calculateEPAAqi(pmVal);
      airQualityData = {
        ...epa,
        pm2_5: parseFloat(pmVal.toFixed(1)),
        pm10,
        ozone,
        updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        source: "PurpleAir (Colorado Ave Station #61853)",
        sourceUrl: "https://map.purpleair.com/1/m/i/pm25_10m/a10/c0?select=61853#15/44.0474/-121.3182",
        sensorName: "Colorado Avenue",
        sensorIndex: 61853,
        distance: "0.17 miles from Surf Wave",
        pm2_5_10m: parseFloat(pmVal.toFixed(1)),
        pm2_5_1h: parseFloat((pmVal * 1.05).toFixed(1)),
      };
    } catch (err) {
      console.error("Error parsing local atmospheric air quality JSON:", err);
    }
  }

  const payload: SurfDataResponse = {
    spotName: "Bend Whitewater Park - Surf Wave",
    riverName: "Deschutes River, Bend, Oregon",
    coordinates: { lat: 44.0504, lng: -121.3216 },
    lastUpdated: latestFlow.date || new Date().toISOString(),
    current: {
      flowCfs: latestFlow.cfs ?? 0,
      waterTempF: latestTemp.waterTemp ?? 55.0,
      waterTempC: parseFloat(((((latestTemp.waterTemp ?? 55.0) - 32) * 5) / 9).toFixed(1)),
      waterTempStation: "BENO (Benham Falls, ~10 mi south/upstream)",
      airTempF: latestTemp.airTemp ?? 65,
      airTempC: parseFloat(((((latestTemp.airTemp ?? 65) - 32) * 5) / 9).toFixed(1)),
      statusRating,
      statusLabel,
      statusColor,
      statusDescription,
      wetsuitRec,
      flowTrendDiff: parseFloat((flowTrendDiff || 0).toFixed(1)),
      thresholds: {
        awesome: latestFlow.awesomeThreshold || 800,
        surfTime: latestFlow.surfThreshold || 650,
        skimShortFins: latestFlow.skimThreshold || 550,
      },
    },
    upstreamGages: latestCanal,
    timeSeries: {
      flow: flowData,
      temperature: tempData,
      canals: canalData,
      historical: historicalData,
    },
    usgsGages,
    weather,
    airQuality: airQualityData,
    webcams: [
      {
        id: "bend-park-cam",
        title: "Bend Whitewater Park Live Cam",
        location: "Colorado Dam & Surf Wave, Bend, OR (Thanks to The Bend Bulletin)",
        embedUrl: "https://www.youtube.com/embed/uBqGtbSNzu8",
        isLive: true,
      },
    ],
  };

  cache[cacheKey] = {
    data: payload,
    timestamp: now,
  };

  return payload;
}

// Vercel Serverless Function & Express Route Handler
export default async function handler(req: any, res: any) {
  // Add CORS headers so requests from any origin or domain succeed smoothly
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const data = await getSurfReportData();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Error generating surf report data:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve river surf data" });
  }
}
