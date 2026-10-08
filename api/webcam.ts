import { getParkCamStatus } from "./_lib/webcam.js";

/**
 * Small status endpoint for the park cam, used by the GitHub webcam monitor.
 * Returns only the live-status lookup (no river data), so checks are cheap.
 */
export default async function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  try {
    const status = await getParkCamStatus();
    res.status(200).json(status);
  } catch (error: any) {
    res.status(500).json({ isLive: null, lookupNote: `status check crashed: ${error?.message ?? error}` });
  }
}
