export type LowersTuneType = "surf-wave" | "wave-hole";

export interface TuneDetails {
  type: LowersTuneType;
  title: string;
  optimization: string;
  badgeLabel: string;
  badgeClass: string;
  heroGradient: string;
  accentColor: string;
  shortDescription: string;
  fullDescription: string;
  idealCrafts: Array<{
    craft: string;
    verdict: string;
    details: string;
  }>;
  pros: string[];
}

export const TUNE_PROFILES: Record<LowersTuneType, TuneDetails> = {
  "surf-wave": {
    type: "surf-wave",
    title: "Surf Wave",
    optimization: "Surfer Optimized",
    badgeLabel: "Surfer Optimized • Surf Wave",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    heroGradient: "from-emerald-950/70 via-slate-900 to-slate-900",
    accentColor: "emerald",
    shortDescription: "Surfer optimized — tuned as a glassy low-gradient wave with a smooth, clean face.",
    fullDescription:
      "Tuned as a glassy low-gradient wave. Ideal for your favorite longboard and a mellow front surf in your kayak.",
    idealCrafts: [
      {
        craft: "Longboard Surfboard",
        verdict: "Ideal & Highly Recommended",
        details: "Surfs clean and smooth on the glassy, low-gradient face. Perfect for trimming and cross-stepping.",
      },
      {
        craft: "Whitewater Kayak",
        verdict: "Mellow Front Surf",
        details: "Clean glassy face provides an easy, comfortable front surf without aggressive grabby edges.",
      },
      {
        craft: "SUP (Stand Up Paddleboard)",
        verdict: "Fun / Good Trimming",
        details: "Wide, low-angle face gives river SUP surfers ample stability on entry.",
      },
      {
        craft: "Boogie Board",
        verdict: "Mellow Ride",
        details: "Gentle glide on the face, though more retentive fun is found on Wave Hole days.",
      },
    ],
    pros: [
      "Glassy, low-gradient wave profile",
      "Ideal for longboard surfing",
      "Mellow front surf for whitewater kayakers",
      "Forgiving entry with soft transitions",
    ],
  },
  "wave-hole": {
    type: "wave-hole",
    title: "Wave Hole",
    optimization: "Kayak Optimized",
    badgeLabel: "Kayak Optimized • Wave Hole",
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-400/30",
    heroGradient: "from-sky-950/70 via-slate-900 to-slate-900",
    accentColor: "sky",
    shortDescription: "Kayak optimized — tuned as a friendly wave-hole with a nice foam pile for spins & boogie boarding.",
    fullDescription:
      "Tuned as a friendly wave-hole with a nice pile. Ideal for spins in your kayak, boogie boards, and shorter high-volume longboards.",
    idealCrafts: [
      {
        craft: "Whitewater Kayak",
        verdict: "Ideal for Spins",
        details: "The foam pile catches your boat nicely for spins, side-surfing, and playboating maneuvers.",
      },
      {
        craft: "Boogie Board / Bodyboard",
        verdict: "Great & High Stoke",
        details: "The foam pile provides continuous push and retentive action for bodyboarders.",
      },
      {
        craft: "Shorter High-Volume Longboards",
        verdict: "Works OK",
        details: "Shorter, thick longboards can hold position in the pocket and bounce the pile.",
      },
      {
        craft: "River Surfing Shortboards",
        verdict: "Niche / Tricky",
        details: "Standard low-volume shortboards can sink; best saved for the Upper Green Wave.",
      },
    ],
    pros: [
      "Friendly wave-hole with a lively, cushioned pile",
      "Good for spins in your kayak",
      "Great for boogie boards in the foam",
      "Shorter high-volume longboards work well",
    ],
  },
};

export interface DayScheduleItem {
  dayIndex: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  dayName: string;
  shortDay: string;
  tuneType: LowersTuneType;
}

export const WEEKLY_SCHEDULE: DayScheduleItem[] = [
  { dayIndex: 0, dayName: "Sunday", shortDay: "Sun", tuneType: "surf-wave" },
  { dayIndex: 1, dayName: "Monday", shortDay: "Mon", tuneType: "surf-wave" },
  { dayIndex: 2, dayName: "Tuesday", shortDay: "Tue", tuneType: "wave-hole" },
  { dayIndex: 3, dayName: "Wednesday", shortDay: "Wed", tuneType: "surf-wave" },
  { dayIndex: 4, dayName: "Thursday", shortDay: "Thu", tuneType: "wave-hole" },
  { dayIndex: 5, dayName: "Friday", shortDay: "Fri", tuneType: "surf-wave" },
  { dayIndex: 6, dayName: "Saturday", shortDay: "Sat", tuneType: "wave-hole" },
];

/**
 * Returns current Date in America/Los_Angeles (Pacific Time)
 */
export function getBendCurrentDate(): Date {
  try {
    const now = new Date();
    const pacificString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const d = new Date(pacificString);
    if (!isNaN(d.getTime())) return d;
  } catch {
    // Fallback if Intl timezone not supported
  }
  return new Date();
}

/**
 * Returns tuning information for today & tomorrow
 */
export function getLowersCurrentStatus() {
  const localDate = getBendCurrentDate();
  const dayIndex = localDate.getDay(); // 0 - 6
  const nextDayIndex = (dayIndex + 1) % 7;

  const todaySchedule = WEEKLY_SCHEDULE[dayIndex];
  const tomorrowSchedule = WEEKLY_SCHEDULE[nextDayIndex];

  const todayProfile = TUNE_PROFILES[todaySchedule.tuneType];
  const tomorrowProfile = TUNE_PROFILES[tomorrowSchedule.tuneType];

  const formattedDate = localDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return {
    dayIndex,
    nextDayIndex,
    todaySchedule,
    tomorrowSchedule,
    todayProfile,
    tomorrowProfile,
    formattedDate,
    dayName: todaySchedule.dayName,
    tomorrowDayName: tomorrowSchedule.dayName,
  };
}
