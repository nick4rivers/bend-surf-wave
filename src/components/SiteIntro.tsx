import React from "react";

// Top-of-page intro. Holds the page's single <h1> (the header logo is not a heading),
// so search engines read "Bend Surf Cam & Surf Report" as the page topic.
export const SiteIntro: React.FC = () => (
  <section aria-labelledby="site-intro-title" className="space-y-1.5">
    <h1
      id="site-intro-title"
      className="font-outfit font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight"
    >
      Bend Surf Cam &amp; Surf Report
    </h1>
    <p className="text-base sm:text-lg font-semibold text-sky-700 leading-snug">
      Live conditions at the Bend Whitewater Park surf wave
    </p>
    <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
      Check the Bend surf cam, current river flow, wave conditions, water temperature and weather
      before heading to the Deschutes River.
    </p>
  </section>
);
