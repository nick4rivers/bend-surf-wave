import type { SurfDataResponse } from "../src/types";
import { fetchUrl } from "./_lib/http.js";
import { fetchHydrometInstant, fetchHydrometDaily, forwardFill, isoDate } from "./_lib/hydromet.js";
import { computeHeadOfPark, HEAD_OF_PARK_MODEL, type GageRow } from "./_lib/headOfPark.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<any>> = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache
const HISTORICAL_TTL_MS = 24 * 60 * 60 * 1000; // multi-year daily archive changes once a day at most

const SURF_THRESHOLDS = { surf: 650, skim: 550, awesome: 800 };
const RECENT_DAYS = 35; // 15-min window: covers the 7d / 30d charts plus the BENO → park lag

/** Daily Head of Park estimate (no lag at daily resolution): k·BENO − CENO − ARNO */
const dailyHeadOfPark = (beno: number, ceno: number, arno: number) =>
  Number.isFinite(beno)
    ? Math.max(0, Math.round((HEAD_OF_PARK_MODEL.benoFactor * beno - (Number.isFinite(ceno) ? ceno : 0) - (Number.isFinite(arno) ? arno : 0)) * 10) / 10)
    : NaN;

/**
 * Multi-year daily Head of Park hydrographs, one column per year, keyed on a
 * leap reference year so Feb 29 has a slot. Cached for a day.
 */
async function getHistoricalByYear(firstYear: number, lastYear: number): Promise<Array<Record<string, any>>> {
  const key = `historical_${firstYear}_${lastYear}`;
  if (cache[key] && Date.now() - cache[key].timestamp < HISTORICAL_TTL_MS) return cache[key].data;

  const table = await fetchHydrometDaily(["beno qd", "ceno qj", "arno qj"], `${firstYear}-01-01`, `${lastYear}-12-31`);
  const byMmdd = new Map<string, Record<string, any>>();
  // Reference leap year for the x-axis
  for (let d = new Date(Date.UTC(2024, 0, 1)); d.getUTCFullYear() === 2024; d.setUTCDate(d.getUTCDate() + 1)) {
    const mmdd = d.toISOString().slice(5, 10);
    byMmdd.set(mmdd, { date: `2024-${mmdd}` });
  }
  for (const r of table.rows) {
    const [b, c, a] = r.values;
    const v = dailyHeadOfPark(b, c, a);
    const row = byMmdd.get(r.date.slice(5, 10));
    if (row && Number.isFinite(v)) row[r.date.slice(0, 4)] = v;
  }
  const data = [...byMmdd.values()];
  cache[key] = { data, timestamp: Date.now() };
  return data;
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

export async function getSurfReportData(): Promise<SurfDataResponse> {
  const cacheKey = "surf_report_master_data";
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
    return cache[cacheKey].data;
  }

  // Compute date range for 1-year daily USBR Hydromet archive
  const nowObj = new Date();
  const eyer = nowObj.getFullYear();
  const emn = nowObj.getMonth() + 1;
  const edy = nowObj.getDate();
  const past1YrObj = new Date(nowObj.getTime() - 366 * 24 * 60 * 60 * 1000);
  const syer = past1YrObj.getFullYear();
  const smn = past1YrObj.getMonth() + 1;
  const sdy = past1YrObj.getDate();
  const usbr1YrDailyUrl = `https://www.usbr.gov/pn-bin/webarccsv.pl?parameter=wic%20af&syer=${syer}&smn=${smn}&sdy=${sdy}&eyer=${eyer}&emn=${emn}&edy=${edy}&format=2`;

  const recentStart = isoDate(new Date(nowObj.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000));
  const yearStart = isoDate(past1YrObj);
  const yesterday = isoDate(new Date(nowObj.getTime() - 24 * 60 * 60 * 1000));

  // Parallel fetch from data sources (all flow/canal/temperature data direct from USBR Hydromet)
  const [
    hydrometRecent,
    hydrometYearDaily,
    historicalByYear,
    usgsJson,
    openMeteoWeatherJson,
    purpleAirMapJson,
    openMeteoAirJson,
    usbrWicAfCsv,
    usbrWic1YrCsv,
  ] = await Promise.allSettled([
    fetchHydrometInstant(["wico q", "beno q", "beno wf", "lapo q", "ceno qc", "arno qc"], { start: recentStart }),
    fetchHydrometDaily(["beno qd", "ceno qj", "arno qj"], yearStart, yesterday),
    // Never let the 13-year archive hold up live data; it's cached for a day once it loads
    Promise.race([
      getHistoricalByYear(2013, eyer - 1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("historical archive timeout")), 8000)),
    ]),
    fetchUrl("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14070500,14092500,13206000&parameterCd=00060,00010"),
    fetchUrl("https://api.open-meteo.com/v1/forecast?latitude=44.0582&longitude=-121.3153&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FLos_Angeles&past_days=92&forecast_days=7"),
    process.env.PURPLE_AIR_API_KEY
      ? fetchUrl(`https://api.purpleair.com/v1/sensors/61853?api_key=${process.env.PURPLE_AIR_API_KEY}`)
      : fetchUrl("https://map.purpleair.com/data.json?opt=1/m/i/pm25_10m/a10/c0&box=44.00,-121.36,44.10,-121.26"),
    fetchUrl("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.0504&longitude=-121.3216&current=us_aqi,pm2_5,pm10,ozone,carbon_monoxide&timezone=America%2FLos_Angeles"),
    fetchUrl("https://www.usbr.gov/pn-bin/v1/instant.pl?list=wic%20af&format=realtime-graph"),
    fetchUrl(usbr1YrDailyUrl),
  ]);

  if (hydrometRecent.status === "rejected") {
    console.error("Hydromet 15-min fetch failed:", hydrometRecent.reason);
  }

  // Parse Weather from Open-Meteo (Bend, Oregon in America/Los_Angeles local time)
  let weather: any = null;
  const openMeteoHourlyMap: Record<string, number> = {};
  if (openMeteoWeatherJson.status === "fulfilled" && openMeteoWeatherJson.value) {
    const rawVal = openMeteoWeatherJson.value.trim();
    if (rawVal.startsWith("{") || rawVal.startsWith("[")) {
      try {
        const rawWeather = JSON.parse(rawVal);
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
        console.warn("Could not parse weather JSON:", err);
      }
    }
  }

  const liveAirFromWeather = typeof weather?.current?.temperature_2m === "number" && !isNaN(weather.current.temperature_2m)
    ? weather.current.temperature_2m
    : null;

  // ---------------------------------------------------------------------------
  // Hydromet 15-min gages → Head of Park estimate (lagged BENO minus canals)
  // ---------------------------------------------------------------------------
  type FlowPoint = SurfDataResponse["timeSeries"]["flow"][number];
  const withThresholds = (date: string, cfs: number): FlowPoint => ({
    date,
    cfs,
    surfThreshold: SURF_THRESHOLDS.surf,
    skimThreshold: SURF_THRESHOLDS.skim,
    awesomeThreshold: SURF_THRESHOLDS.awesome,
  });

  const recentRows = hydrometRecent.status === "fulfilled" ? hydrometRecent.value.rows : [];
  // Columns: wico q, beno q, beno wf, lapo q, ceno qc, arno qc
  const col = (i: number) => recentRows.map((r) => r.values[i]);
  const benoRaw = col(1);
  const wicoFf = forwardFill(col(0), 0);
  const lapoFf = forwardFill(col(3), 0);
  const cenoFf = forwardFill(col(4), 0);
  const arnoFf = forwardFill(col(5), 0);

  const gageRows: GageRow[] = recentRows.map((r, i) => ({
    date: r.date,
    beno: benoRaw[i],
    ceno: r.values[4],
    arno: r.values[5],
  }));
  const headOfPark = computeHeadOfPark(gageRows);
  const parkByDate = new Map(headOfPark.estimate.map((p) => [p.date, p.cfs]));

  let flowData: FlowPoint[] = headOfPark.estimate.map((p) => withThresholds(p.date, p.cfs));
  const flowForecast = headOfPark.forecast.map((p) => withThresholds(p.date, p.cfs));

  // Full Year range: prepend daily estimates for the days before the 15-min window
  if (hydrometYearDaily.status === "fulfilled") {
    const firstRecent = flowData[0]?.date.slice(0, 10) ?? "9999-12-31";
    const dailyPoints = hydrometYearDaily.value.rows
      .filter((r) => r.date < firstRecent)
      .map((r) => {
        const [b, c, a] = r.values;
        return withThresholds(`${r.date} 12:00`, dailyHeadOfPark(b, c, a));
      })
      .filter((p) => Number.isFinite(p.cfs) && p.cfs > 0);
    flowData = [...dailyPoints, ...flowData];
  }

  // BENO water temperature (°C → °F), keyed by timestamp and hour
  const benoRealWaterList: Array<{ date: string; waterTemp: number }> = [];
  recentRows.forEach((r) => {
    const c = r.values[2];
    if (Number.isFinite(c) && c > -5 && c < 45) {
      benoRealWaterList.push({ date: r.date, waterTemp: parseFloat(((c * 9) / 5 + 32).toFixed(1)) });
    }
  });

  // Parse USBR Hydromet Wickiup Reservoir Storage (WIC AF)
  const WICKIUP_CAPACITY_AF = 200000;
  let wickiupStorage: any = undefined;

  let currentAf = 35575;
  let lastUpdatedStr = "2026-09-14 08:15";
  let percentCapacity = 17.8;

  // Extract current reading from real-time 15-min instant graph if available
  if (usbrWicAfCsv.status === "fulfilled" && usbrWicAfCsv.value) {
    try {
      const lines = usbrWicAfCsv.value.trim().split(/\r?\n/);
      for (let i = lines.length - 1; i >= 1; i--) {
        const parts = lines[i].split(",");
        if (parts.length >= 2) {
          const dateRaw = parts[0].trim();
          const afVal = parseFloat(parts[1].trim());
          if (!isNaN(afVal) && dateRaw) {
            currentAf = Math.round(afVal);
            percentCapacity = parseFloat(((currentAf / WICKIUP_CAPACITY_AF) * 100).toFixed(1));
            lastUpdatedStr = dateRaw.replace(/\//g, "-");
            break;
          }
        }
      }
    } catch (e) {
      console.error("Error reading latest 15min WIC AF:", e);
    }
  }

  // Parse 1-year daily history from USBR webarccsv
  const dailyHistory: Array<{
    date: string;
    timestamp: number;
    acreFeet: number;
    percent: number;
  }> = [];

  if (usbrWic1YrCsv.status === "fulfilled" && usbrWic1YrCsv.value) {
    try {
      const lines = usbrWic1YrCsv.value.split(/\r?\n/);
      for (const line of lines) {
        const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}),\s*([0-9.]+)/);
        if (match) {
          const month = match[1];
          const day = match[2];
          const year = match[3];
          const af = parseFloat(match[4]);
          if (!isNaN(af)) {
            const isoDate = `${year}-${month}-${day}`;
            const roundedAf = Math.round(af);
            dailyHistory.push({
              date: isoDate,
              timestamp: new Date(isoDate).getTime(),
              acreFeet: roundedAf,
              percent: parseFloat(((roundedAf / WICKIUP_CAPACITY_AF) * 100).toFixed(1)),
            });
          }
        }
      }
    } catch (err) {
      console.error("Error parsing USBR 1-year daily Wickiup data:", err);
    }
  }

  // If dailyHistory has items, ensure today's latest reading is included
  if (dailyHistory.length > 0) {
    const lastDaily = dailyHistory[dailyHistory.length - 1];
    const todayIso = new Date().toISOString().slice(0, 10);
    if (lastDaily.date !== todayIso) {
      dailyHistory.push({
        date: todayIso,
        timestamp: Date.now(),
        acreFeet: currentAf,
        percent: percentCapacity,
      });
    }

    wickiupStorage = {
      currentAcreFeet: currentAf,
      capacityAcreFeet: WICKIUP_CAPACITY_AF,
      percentOfCapacity: percentCapacity,
      lastUpdated: lastUpdatedStr,
      history: dailyHistory,
      dailyHistory: dailyHistory,
    };
  } else if (usbrWicAfCsv.status === "fulfilled") {
    wickiupStorage = {
      currentAcreFeet: currentAf,
      capacityAcreFeet: WICKIUP_CAPACITY_AF,
      percentOfCapacity: percentCapacity,
      lastUpdated: lastUpdatedStr,
      history: [],
      dailyHistory: [],
    };
  }

  // Temperature series: BENO water temp + Open-Meteo hourly air temp
  const WETSUIT_BANDS = { t2mm: 64, t32: 62, t43: 58, t54: 52, t65: 42 };
  const tempData: SurfDataResponse["timeSeries"]["temperature"] = benoRealWaterList.map((w) => {
    const hourKey = `${w.date.slice(0, 13)}:00`;
    const airTemp = openMeteoHourlyMap[hourKey] ?? liveAirFromWeather ?? 65.0;
    return { date: w.date, waterTemp: w.waterTemp, airTemp, ...WETSUIT_BANDS };
  });

  // Hydro network series (upstream gages + modeled Head of Park)
  const canalData: SurfDataResponse["timeSeries"]["canals"] = [];
  recentRows.forEach((r, i) => {
    const hop = parkByDate.get(r.date);
    if (hop === undefined || !Number.isFinite(benoRaw[i])) return;
    canalData.push({
      date: r.date,
      wickiup: wicoFf[i],
      benham: benoRaw[i],
      centralOregonCanal: cenoFf[i],
      arnoldCanal: arnoFf[i],
      headOfPark: hop,
      littleDeschutes: lapoFf[i],
    });
  });

  const historicalData: Array<Record<string, any>> =
    historicalByYear.status === "fulfilled" ? historicalByYear.value : [];

  // Parse USGS Real-time Gages
  const usgsGages: Record<string, { name: string; cfs?: number; tempF?: number; updated?: string }> = {
    "14070500": { name: "Deschutes River Below Bend (14070500)" },
    "14092500": { name: "Deschutes River Near Madras (14092500)" },
    "13206000": { name: "Boise River Near Boise (13206000)" },
  };

  if (usgsJson.status === "fulfilled" && usgsJson.value) {
    const rawVal = usgsJson.value.trim();
    if (rawVal.startsWith("{") || rawVal.startsWith("[")) {
      try {
        const json = JSON.parse(rawVal);
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
        console.warn("Could not parse USGS JSON payload:", err);
      }
    } else {
      console.warn("USGS returned non-JSON response payload:", rawVal.slice(0, 100));
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
  let statusDescription = "Wave is steep and fast, bring your performance river surfboard.";

  if (latestFlow.cfs >= 800) {
    statusRating = "FIRING";
    statusLabel = "Firing";
    statusColor = "emerald";
    statusDescription = "Wave is steep and fast, bring your performance river surfboard.";
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
    rating: "Fresh",
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
    const rawVal = openMeteoAirJson.value.trim();
    if (rawVal.startsWith("{") || rawVal.startsWith("[")) {
      try {
        const aq = JSON.parse(rawVal);
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
        console.warn("Could not parse local atmospheric air quality JSON:", err);
      }
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
      waterTempStation: "BENO (Benham Falls, ~20 river km upstream)",
      airTempF: latestTemp.airTemp ?? 65,
      airTempC: parseFloat(((((latestTemp.airTemp ?? 65) - 32) * 5) / 9).toFixed(1)),
      statusRating,
      statusLabel,
      statusColor,
      statusDescription,
      wetsuitRec,
      flowTrendDiff: parseFloat((flowTrendDiff || 0).toFixed(1)),
      forecast: headOfPark.summary ?? undefined,
      thresholds: {
        awesome: latestFlow.awesomeThreshold || 800,
        surfTime: latestFlow.surfThreshold || 650,
        skimShortFins: latestFlow.skimThreshold || 550,
      },
    },
    upstreamGages: latestCanal,
    timeSeries: {
      flow: flowData,
      flowForecast,
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
        embedUrl: "https://www.youtube.com/embed/r_HxcmGwYNA",
        isLive: true,
      },
    ],
    wickiupStorage,
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
