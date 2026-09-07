/**
 * Date and Time formatting utilities for hydrographs and surf report popups.
 * Eliminates artificial "12:00 AM" for date-only records and provides clean,
 * responsive date/time strings.
 */

export interface FormattedDateResult {
  shortDate: string;      // e.g. "Aug 30"
  shortTime: string | null; // e.g. "2:00 PM"
  shortLabel: string;     // for chart X-axis: "Aug 30"
  displayTime: string;    // "Aug 30, 2026"
  displayDate: string;    // "Aug 30, 2026"
  fullDateWithYear: string; // "Aug 30, 2026"
}

export function formatHydroDateTime(
  rawDate: string,
  timeRange?: "24h" | "7d" | "30d" | "all" | string
): FormattedDateResult {
  if (!rawDate) {
    return {
      shortDate: "",
      shortTime: null,
      shortLabel: "",
      displayTime: "",
      displayDate: "",
      fullDateWithYear: "",
    };
  }

  const trimmed = rawDate.trim();
  const parts = trimmed.split(/[T ]/);
  const datePart = parts[0] || "";
  const timePart = parts[1] ? parts[1].replace(/Z$/, "") : "";

  // Parse YYYY-MM-DD or MM/DD/YYYY
  let year = new Date().getFullYear();
  let month = 0;
  let day = 1;

  if (datePart.includes("-")) {
    const dp = datePart.split("-").map(Number);
    if (dp.length >= 3) {
      year = dp[0];
      month = dp[1] - 1;
      day = dp[2];
    }
  } else if (datePart.includes("/")) {
    const dp = datePart.split("/").map(Number);
    if (dp.length >= 3) {
      month = dp[0] - 1;
      day = dp[1];
      year = dp[2] < 100 ? 2000 + dp[2] : dp[2];
    }
  } else {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[month] || "Jan";
  const shortDate = `${monthName} ${day}`;
  const fullDateWithYear = `${monthName} ${day}, ${year}`;

  let shortTime: string | null = null;

  // Check if there is an explicit time component
  if (timePart) {
    const tp = timePart.split(":");
    const hours = parseInt(tp[0], 10);
    const minutes = parseInt(tp[1] || "0", 10);
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? "PM" : "AM";
      const h12 = hours % 12 === 0 ? 12 : hours % 12;
      const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      shortTime = `${h12}:${minStr} ${ampm}`;
    }
  }

  // Display date for popup tooltips & X-axis: clean date only (no time)
  const displayDate = fullDateWithYear;
  const displayTime = fullDateWithYear;
  const shortLabel = shortDate;

  return {
    shortDate,
    shortTime,
    shortLabel,
    displayTime,
    displayDate,
    fullDateWithYear,
  };
}
