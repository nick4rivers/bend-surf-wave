/**
 * ============================================================================
 * SURF REPORT PROMPT & LOGIC CONFIGURATION
 * ============================================================================
 * You can edit this file anytime in the editor to tweak the prompt, add new
 * rules, add custom Surfline examples, or change how flow/weather comparisons
 * are presented to Gemini.
 */

export interface SurfReportConditions {
  currentCfs: number;
  flowTrendDiff?: number;
  statusLabel: string;
  statusRating: string;
  yesterdayCfs?: number;
  twoDaysAgoCfs?: number;
  flowTrendDescription: string;
  waterTempF?: number;
  airTempF?: number;
  highTempF?: number;
  weatherCondition?: string;
  aqi?: number;
  aqiCategory?: string;
  aqiRating?: string;
  canalDiversionsCfs?: number;
}

/**
 * System Instructions for the AI Surf Forecaster
 */
export const SURFLINE_SYSTEM_INSTRUCTIONS = `
You are the lead forecaster for the Bend Whitewater Park on the Deschutes River in Bend, Oregon.
Your voice is inspired by Surfline spot forecasters: authentic, knowledgeable, wave-focused, crisp, and energetic without being overly cheesy.
You understand river surfing mechanics deeply:
- 800+ CFS = "Firing": Steep, fast, punchy wave pocket. Ideal for high-performance river shortboards.
- 650–800 CFS = "Surfing": Fun, carveable shoulder with solid push. Works well for standard river boards and fish shapes.
- 550–650 CFS = "Skim / Short Fins": Softer, flatter face. Suited for high-volume boards, twin/single fins, or soft-tops.
- Under 550 CFS = "Low / Flat": Below rideable threshold for shortboards; mostly for SUPs or floating.
`.trim();

/**
 * Builds the prompt sent to Gemini based on live conditions.
 * You can edit the text, rules, and few-shot examples below!
 */
export function buildSurfReportPrompt(data: SurfReportConditions): string {
  const {
    currentCfs,
    flowTrendDiff = 0,
    statusLabel,
    yesterdayCfs,
    twoDaysAgoCfs,
    flowTrendDescription,
    highTempF,
    airTempF,
    waterTempF,
    weatherCondition,
    aqi,
    aqiCategory,
  } = data;

  // Flow comparison narrative
  let flowComparisonText = "";
  if (yesterdayCfs && yesterdayCfs > 0) {
    const diff = currentCfs - yesterdayCfs;
    if (Math.abs(diff) <= 10) {
      flowComparisonText = `Flow is holding steady compared to yesterday (${yesterdayCfs} CFS vs today's ${currentCfs} CFS).`;
    } else if (diff > 0) {
      flowComparisonText = `Flow is up +${Math.round(diff)} CFS over yesterday (${yesterdayCfs} CFS up to ${currentCfs} CFS).`;
    } else {
      flowComparisonText = `Flow is down ${Math.round(Math.abs(diff))} CFS compared to yesterday (${yesterdayCfs} CFS down to ${currentCfs} CFS).`;
    }
  } else {
    flowComparisonText = `Current flow is ${currentCfs} CFS (${flowTrendDescription}).`;
  }

  if (twoDaysAgoCfs && twoDaysAgoCfs > 0) {
    flowComparisonText += ` Two days ago flows were around ${twoDaysAgoCfs} CFS.`;
  }

  // Weather & forecast high
  const displayHigh = highTempF ? `${Math.round(highTempF)}°F` : (airTempF ? `${Math.round(airTempF)}°F` : "seasonal");
  const weatherDesc = weatherCondition ? weatherCondition : "clear Cascade skies";

  // AQI condition note
  let aqiNote = "";
  if (typeof aqi === "number") {
    if (aqi > 100) {
      aqiNote = `WARNING: Air Quality Index is currently ${aqi} (${aqiCategory || "Unhealthy"}). Smoke/haze is affecting the basin; advise limiting heavy exertion.`;
    } else if (aqi > 50) {
      aqiNote = `NOTE: Air Quality is moderate (${aqi} AQI, ${aqiCategory || "Moderate"}). Slight haze present.`;
    } else {
      aqiNote = `Air quality is fresh and clean (${aqi} AQI - Good). No smoke concerns.`;
    }
  }

  return `
Current River & Weather Conditions for Bend Whitewater Park (Upper Green Wave):
- Current Flow: ${currentCfs} CFS (${statusLabel})
- Flow Trend: ${flowComparisonText}
- River Water Temp: ${waterTempF ? `${Math.round(waterTempF)}°F` : "54°F"}
- Today's Forecast High: ${displayHigh} (${weatherDesc})
- Air Quality: ${aqiNote || "Fresh mountain air"}

INSTRUCTIONS:
Write a concise, 2 to 3 sentence Surfline-style daily surf report for Bend river surfers based on the conditions above.
Key requirements:
1. Highlight the current river flow (${currentCfs} CFS) and directly compare it to previous days (e.g. whether it is holding steady, bumped up, or dropped).
2. Detail how the wave is surfing today based on that flow (steepness, speed, board recommendations).
3. Mention the weather forecast, focusing on today's high temperature (${displayHigh}).
4. If AQI is elevated (>50 or smoky), mention it so surfers know what to expect for air quality. If air quality is good, you can briefly note clear skies or omit AQI.
5. Tone: Authentic Surfline forecaster tone—punchy, informative, direct.
6. Length: Exactly 2 to 3 sentences total (under 60 words). Do not include bullet points or greetings; just the report text.
`.trim();
}

/**
 * Fallback generator when Gemini API is unavailable or offline.
 * Produces a high quality, dynamic Surfline-style report matching the exact prompt logic.
 */
export function generateAlgorithmicFallback(data: SurfReportConditions): string {
  const { currentCfs, yesterdayCfs, highTempF, airTempF, aqi } = data;
  const highStr = highTempF ? `${Math.round(highTempF)}°F` : (airTempF ? `${Math.round(airTempF)}°F` : "pleasant temps");

  let waveAnalysis = "";
  if (currentCfs >= 800) {
    waveAnalysis = `Flows are firing at ${currentCfs} CFS, delivering a steep, fast pocket that's primed for performance river shortboards.`;
  } else if (currentCfs >= 650) {
    waveAnalysis = `Holding solid at ${currentCfs} CFS, offering a clean, carveable shoulder with plenty of push for standard river shapes.`;
  } else if (currentCfs >= 550) {
    waveAnalysis = `Sitting at ${currentCfs} CFS with a mellow, lower-angle face best suited for high-volume boards, twin-fins, or soft-tops.`;
  } else {
    waveAnalysis = `Flows are down to ${currentCfs} CFS, running below standard shortboard thresholds—great for SUPs or a mellow cruise.`;
  }

  let trendPart = "";
  if (yesterdayCfs && yesterdayCfs > 0) {
    const diff = currentCfs - yesterdayCfs;
    if (Math.abs(diff) <= 10) {
      trendPart = `River levels are holding steady with yesterday.`;
    } else if (diff > 0) {
      trendPart = `Discharge bumped up ${Math.round(diff)} CFS over yesterday's mark.`;
    } else {
      trendPart = `Water has eased off ${Math.round(Math.abs(diff))} CFS compared to yesterday.`;
    }
  }

  let weatherPart = `Expect sunny skies with today's high climbing near ${highStr}.`;
  if (aqi && aqi > 100) {
    weatherPart += ` Keep in mind elevated smoke has pushed AQI to ${aqi}, so pace your session.`;
  } else if (aqi && aqi > 50) {
    weatherPart += ` Basin air is moderate with slight haze (${aqi} AQI).`;
  }

  return `${waveAnalysis} ${trendPart} ${weatherPart}`.trim();
}
