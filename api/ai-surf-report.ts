import { GoogleGenAI } from "@google/genai";
import {
  buildSurfReportPrompt,
  SURFLINE_SYSTEM_INSTRUCTIONS,
  generateAlgorithmicFallback,
  SurfReportConditions,
} from "./surf-report-prompt";

// Cache in-memory strictly for 15s to debounce simultaneous React StrictMode mounts
// while ensuring every browser open / refresh gets a fresh, live Gemini generation
let reportCache: {
  key: string;
  report: string;
  timestamp: number;
  model: string;
} | null = null;

const CACHE_TTL_MS = 15 * 1000; // 15 seconds debounce

export default async function aiSurfReportHandler(req: any, res: any) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const conditions: SurfReportConditions = req.body || req.query || {};
    const currentCfs = conditions.currentCfs ?? 0;
    const forceRefresh = req.query?.refresh === "true" || req.body?.refresh === true;

    // Cache key based on flow rounded to nearest 5 cfs and current date
    const todayStr = new Date().toISOString().slice(0, 10);
    const cacheKey = `${todayStr}-${Math.round(currentCfs / 5) * 5}-${conditions.yesterdayCfs || 0}`;

    if (!forceRefresh && reportCache && reportCache.key === cacheKey && Date.now() - reportCache.timestamp < CACHE_TTL_MS) {
      return res.status(200).json({
        report: reportCache.report,
        source: reportCache.model,
        cached: true,
        generatedAt: new Date(reportCache.timestamp).toISOString(),
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY not set. Serving high-fidelity algorithmic Surfline report.");
      const fallbackReport = generateAlgorithmicFallback(conditions);
      return res.status(200).json({
        report: fallbackReport,
        source: "Algorithmic Forecaster (Add GEMINI_API_KEY in Secrets for live Gemini)",
        cached: false,
        generatedAt: new Date().toISOString(),
      });
    }

    // Call Gemini 3.8 Flash
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = buildSurfReportPrompt(conditions);

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: SURFLINE_SYSTEM_INSTRUCTIONS,
        temperature: 0.7,
      },
    });

    let generatedText = (response.text || "").trim();

    // Cleanup any quotation marks or leading/trailing markdown if returned
    generatedText = generatedText.replace(/^["']|["']$/g, "").trim();

    if (!generatedText) {
      generatedText = generateAlgorithmicFallback(conditions);
    }

    reportCache = {
      key: cacheKey,
      report: generatedText,
      timestamp: Date.now(),
      model: "Gemini 3.8 Flash",
    };

    return res.status(200).json({
      report: generatedText,
      source: "Gemini 3.8 Flash",
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error generating Gemini surf report:", error);
    // Graceful fallback so UI is always responsive
    const fallbackReport = generateAlgorithmicFallback(req.body || {});
    return res.status(200).json({
      report: fallbackReport,
      source: "Forecaster Fallback",
      cached: false,
      generatedAt: new Date().toISOString(),
      errorNote: error.message || "Failed to contact Gemini API",
    });
  }
}
