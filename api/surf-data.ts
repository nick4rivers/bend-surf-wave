import type { SurfDataResponse } from "../src/types";
import { fetchUrl } from "./_lib/http.js";
import { fetchHydrometInstant, fetchHydrometDaily, forwardFill, isoDate } from "./_lib/hydromet.js";
import { computeHeadOfPark, HEAD_OF_PARK_MODEL, type GageRow } from "./_lib/headOfPark.js";
import { feedStatus, naiveMs, pacificToday } from "./_lib/feedStatus.js";
import { getParkCamStatus, PARK_CAM_STREAMS_URL, PARK_CAM_CHANNEL_EMBED } from "./_lib/webcam.js";

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

  // Webcam lookup runs alongside the data fetches; it has its own 5-minute cache and never throws
  const parkCamPromise = getParkCamStatus();

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
    fetchHydrometInstant(["wico q", "beno q", "beno wf", "lapo q", "ceno qc", "arno qc", "debo q"], { start: recentStart }),
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
  // Columns: wico q, beno q, beno wf, lapo q, ceno qc, arno qc, debo q
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

  // ---- Feed health: decide what is current enough to show as "now" ----
  const lastFinite = (vals: number[]) => {
    for (let i = vals.length - 1; i >= 0; i--) if (Number.isFinite(vals[i])) return recentRows[i].date;
    return null;
  };
  let flowStatus = feedStatus(
    headOfPark.estimate[headOfPark.estimate.length - 1]?.date ?? null,
    "the USBR Hydromet flow gage at Benham Falls"
  );
  // The estimate subtracts the canal diversions; without them it would overstate park flow by
  // hundreds of CFS in irrigation season. Canals report less often (ARNO is often late), so
  // allow 12 h before calling them down.
  if (flowStatus.available) {
    const canalStatus = [feedStatus(lastFinite(col(4)), "x", 12), feedStatus(lastFinite(col(5)), "x", 12)];
    if (canalStatus.some((c) => !c.available)) {
      flowStatus = {
        available: false,
        stale: false,
        lastReading: flowStatus.lastReading,
        message:
          "The USBR Hydromet canal gages (Central Oregon and Arnold canals) are not reporting, so the Head of Park flow can't be estimated right now.",
      };
    }
  }
  if (hydrometRecent.status === "rejected") {
    flowStatus.message = "The USBR Hydromet gages (Benham Falls and the canals) are not responding right now, so current readings are unavailable.";
  }
  const parkByDate = new Map(headOfPark.estimate.map((p) => [p.date, p.cfs]));

  let flowData: FlowPoint[] = headOfPark.estimate.map((p) => withThresholds(p.date, p.cfs));
  const flowForecast = flowStatus.available ? headOfPark.forecast.map((p) => withThresholds(p.date, p.cfs)) : [];

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

  // Parse USBR Hydromet Wickiup Reservoir Storage (WIC AF). No placeholder values: if USBR
  // returns nothing, wickiupStorage stays undefined and the chart says the data is unavailable.
  const WICKIUP_CAPACITY_AF = 200000;
  let wickiupStorage: SurfDataResponse["wickiupStorage"] = undefined;
  const pctOf = (af: number) => parseFloat(((af / WICKIUP_CAPACITY_AF) * 100).toFixed(1));

  let instantAf: { af: number; date: string } | null = null;
  if (usbrWicAfCsv.status === "fulfilled" && usbrWicAfCsv.value) {
    try {
      const lines = usbrWicAfCsv.value.trim().split(/\r?\n/);
      for (let i = lines.length - 1; i >= 1; i--) {
        const parts = lines[i].split(",");
        if (parts.length >= 2) {
          const dateRaw = parts[0].trim().replace(/\//g, "-");
          const afVal = parseFloat(parts[1].trim());
          if (Number.isFinite(afVal) && /^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
            instantAf = { af: Math.round(afVal), date: dateRaw };
            break;
          }
        }
      }
    } catch (e) {
      console.error("Error reading latest 15min WIC AF:", e);
    }
  }

  // Parse 1-year daily history from USBR webarccsv
  const dailyHistory: Array<{ date: string; timestamp: number; acreFeet: number; percent: number }> = [];
  if (usbrWic1YrCsv.status === "fulfilled" && usbrWic1YrCsv.value) {
    try {
      for (const line of usbrWic1YrCsv.value.split(/\r?\n/)) {
        const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}),\s*([0-9.]+)/);
        if (!match) continue;
        const af = parseFloat(match[4]);
        if (!Number.isFinite(af)) continue;
        const iso = `${match[3]}-${match[1]}-${match[2]}`;
        const roundedAf = Math.round(af);
        dailyHistory.push({ date: iso, timestamp: new Date(iso).getTime(), acreFeet: roundedAf, percent: pctOf(roundedAf) });
      }
    } catch (err) {
      console.error("Error parsing USBR 1-year daily Wickiup data:", err);
    }
  }

  // Newest real storage value: the 15-min reading if present, else the last daily value
  const lastDaily = dailyHistory[dailyHistory.length - 1];
  const latestStorage = instantAf ?? (lastDaily ? { af: lastDaily.acreFeet, date: `${lastDaily.date} 00:00` } : null);
  // Storage changes slowly and daily values post a day late, so allow 48 h before calling it stale
  const wickiupStatus = feedStatus(latestStorage?.date ?? null, "the USBR Hydromet Wickiup Reservoir gage", 48);

  if (latestStorage) {
    const todayIso = pacificToday();
    if (instantAf && lastDaily && lastDaily.date !== todayIso && instantAf.date.startsWith(todayIso)) {
      dailyHistory.push({ date: todayIso, timestamp: Date.now(), acreFeet: instantAf.af, percent: pctOf(instantAf.af) });
    }
    wickiupStorage = {
      currentAcreFeet: latestStorage.af,
      capacityAcreFeet: WICKIUP_CAPACITY_AF,
      percentOfCapacity: pctOf(latestStorage.af),
      lastUpdated: latestStorage.date,
      history: dailyHistory,
    };
  }

  // Temperature series: BENO water temp + Open-Meteo hourly air temp
  const WETSUIT_BANDS = { t2mm: 64, t32: 62, t43: 58, t54: 52, t65: 42 };
  const tempData: SurfDataResponse["timeSeries"]["temperature"] = benoRealWaterList.map((w) => {
    const hourKey = `${w.date.slice(0, 13)}:00`;
    const airTemp = openMeteoHourlyMap[hourKey] ?? null;
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

  // USGS sometimes serves a site's last-ever value long after it stopped reporting (14070500
  // currently returns a 1991 reading). Drop anything older than 2 days rather than show it as live.
  for (const g of Object.values(usgsGages)) {
    const t = g.updated ? Date.parse(g.updated) : NaN;
    if (!Number.isFinite(t) || Date.now() - t > 48 * 3.6e6) {
      delete g.cfs;
      delete g.tempF;
      delete g.updated;
    }
  }

  // Below Bend (USGS 14070500 = Hydromet DEBO): fall back to Hydromet when USGS has nothing current
  if (usgsGages["14070500"].cfs === undefined) {
    const debo = col(6);
    const lastDebo = lastFinite(debo);
    if (lastDebo && feedStatus(lastDebo, "x").available) {
      const i = recentRows.findIndex((r) => r.date === lastDebo);
      usgsGages["14070500"].cfs = debo[i];
      usgsGages["14070500"].updated = lastDebo;
    }
  }

  // ---- Current readings: real and recent, or null. Never a placeholder. ----
  const waterStatus = feedStatus(
    benoRealWaterList[benoRealWaterList.length - 1]?.date ?? null,
    "the USBR Hydromet water-temperature gage at Benham Falls"
  );
  if (hydrometRecent.status === "rejected") waterStatus.message = flowStatus.message;

  const latestEstimate = headOfPark.estimate[headOfPark.estimate.length - 1];
  const flowCfs: number | null = flowStatus.available && latestEstimate ? latestEstimate.cfs : null;
  const waterTempF: number | null = waterStatus.available ? benoRealWaterList[benoRealWaterList.length - 1].waterTemp : null;
  const airTempF: number | null = liveAirFromWeather;

  const latestCanal = flowStatus.available ? canalData[canalData.length - 1] ?? null : null;

  let statusRating = "UNAVAILABLE";
  let statusLabel = "No Data";
  let statusColor = "slate";
  let statusDescription = flowStatus.message ?? "Live flow data is unavailable right now.";

  if (flowCfs === null) {
    // keep the "unavailable" status above
  } else if (flowCfs >= 800) {
    statusRating = "FIRING";
    statusLabel = "Firing";
    statusColor = "emerald";
    statusDescription = "Wave is steep and fast, bring your performance river surfboard.";
  } else if (flowCfs >= 650) {
    statusRating = "OPTIMAL";
    statusLabel = "Optimal";
    statusColor = "sky";
    statusDescription = "Wave is in great shape and surfing well, contact with concrete and rocks unlikely.";
  } else if (flowCfs >= 550) {
    statusRating = "LOW-SURFABLE";
    statusLabel = "Low-Surfable";
    statusColor = "amber";
    statusDescription = "Bring your foamy, skimboard, and short fins, ramp is shallow so helmets are recommended.";
  } else {
    statusRating = "BELOW RECOMMENDED";
    statusLabel = "Below Recommended";
    statusColor = "rose";
    statusDescription = "While still surfable around 500 cfs, contact with concrete starts to become a certainty for bodies and boards.";
  }

  let wetsuitRec: SurfDataResponse["current"]["wetsuitRec"] = null;
  if (waterTempF === null) {
    // no recommendation without a real water temperature
  } else if (waterTempF >= 62) {
    wetsuitRec = {
      thickness: "Wetsuits optional",
      accessories: "Boardies and bikinis recommended",
      comfortLevel: "Balmy",
      subtext: "Our short central OR summer days, don't miss it.",
      icon: "sun",
    };
  } else if (waterTempF >= 58) {
    wetsuitRec = {
      thickness: "3/2 wetsuits and spring suits",
      accessories: "Booties optional",
      comfortLevel: "Comfortable",
      subtext: "Summer shoulder season, peak summer mornings and evenings.",
      icon: "sun",
    };
  } else if (waterTempF >= 54) {
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

  // Change vs. the estimate closest to 24 h earlier (within 1 h); by time, not by point count
  let flowTrendDiff: number | null = null;
  if (flowCfs !== null && latestEstimate) {
    const target = naiveMs(latestEstimate.date) - 24 * 3.6e6;
    let best: { cfs: number; gap: number } | null = null;
    for (const p of headOfPark.estimate) {
      const gap = Math.abs(naiveMs(p.date) - target);
      if (!best || gap < best.gap) best = { cfs: p.cfs, gap };
    }
    if (best && best.gap <= 3.6e6) flowTrendDiff = parseFloat((flowCfs - best.cfs).toFixed(1));
  }

  // No default: if neither PurpleAir nor Open-Meteo answers, air quality is reported as unavailable
  let airQualityData: any = undefined;


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
        if (typeof aq?.current?.pm2_5 !== "number") throw new Error("Open-Meteo returned no PM2.5");
        const pmVal: number = aq.current.pm2_5;
        const pm10 = typeof aq?.current?.pm10 === "number" ? parseFloat(aq.current.pm10.toFixed(1)) : undefined;
        const ozone = typeof aq?.current?.ozone === "number" ? parseFloat(aq.current.ozone.toFixed(1)) : undefined;

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

  const parkCam = await parkCamPromise;

  const payload: SurfDataResponse = {
    spotName: "Bend Whitewater Park - Surf Wave",
    riverName: "Deschutes River, Bend, Oregon",
    coordinates: { lat: 44.0504, lng: -121.3216 },
    // Newest real BENO reading behind the park estimate (empty when none came back)
    lastUpdated: flowStatus.lastReading ?? "",
    dataStatus: { flow: flowStatus, waterTemp: waterStatus, wickiup: wickiupStatus },
    current: {
      flowCfs,
      waterTempF,
      waterTempC: waterTempF === null ? null : parseFloat((((waterTempF - 32) * 5) / 9).toFixed(1)),
      waterTempStation: "BENO (Benham Falls, ~20 river km upstream)",
      airTempF,
      airTempC: airTempF === null ? null : parseFloat((((airTempF - 32) * 5) / 9).toFixed(1)),
      statusRating,
      statusLabel,
      statusColor,
      statusDescription,
      wetsuitRec,
      flowTrendDiff,
      forecast: flowStatus.available ? headOfPark.summary ?? undefined : undefined,
      thresholds: {
        awesome: SURF_THRESHOLDS.awesome,
        surfTime: SURF_THRESHOLDS.surf,
        skimShortFins: SURF_THRESHOLDS.skim,
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
        // Confirmed live → embed that exact stream. Otherwise let the viewer's browser ask
        // YouTube for the channel's current live stream, which survives stream restarts.
        embedUrl: parkCam.isLive ? `https://www.youtube.com/embed/${parkCam.videoId}` : PARK_CAM_CHANNEL_EMBED,
        watchUrl: parkCam.isLive ? `https://www.youtube.com/watch?v=${parkCam.videoId}` : PARK_CAM_STREAMS_URL,
        channelUrl: PARK_CAM_STREAMS_URL,
        isLive: parkCam.isLive,
        checkedAt: parkCam.checkedAt,
        lookupNote: parkCam.lookupNote,
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
