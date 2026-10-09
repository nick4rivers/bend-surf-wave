import React from "react";
import { Video, Waves, Thermometer, CloudSun, CalendarDays, Mountain, ArrowRight } from "lucide-react";
import { ActiveTab } from "../types";

interface AboutSectionProps {
  onNavigate: (tab: ActiveTab) => void;
}

interface Feature {
  icon: React.ElementType;
  title: string;
  body: string;
  tab: ActiveTab;
  cta: string;
}

const FEATURES: Feature[] = [
  {
    icon: Video,
    title: "Live surf cam",
    body: "Watch the Bend Whitewater Park wave in real time and see the crowd and the line before you load the car.",
    tab: "overview",
    cta: "Watch the cam",
  },
  {
    icon: Waves,
    title: "River flow at the wave",
    body: "Modeled flow in CFS at the head of the park, built from the Benham Falls gage upstream minus irrigation canal diversions, with a surf rating from Below Minimum to Firing.",
    tab: "flow",
    cta: "See flow details",
  },
  {
    icon: Thermometer,
    title: "Water temperature & wetsuit guide",
    body: "Current Deschutes River water temperature, its recent trend, and a suggested wetsuit thickness.",
    tab: "temperature",
    cta: "Check water temp",
  },
  {
    icon: CloudSun,
    title: "Weather & air quality",
    body: "Bend forecast plus nearby air quality, so you know about wind, cold snaps and wildfire smoke before you paddle out.",
    tab: "temperature",
    cta: "See the forecast",
  },
  {
    icon: CalendarDays,
    title: "Lowers wave report",
    body: "Today's tune for the lower wave (glassy surf wave or a steeper wave-hole) and which craft suits it.",
    tab: "lowers",
    cta: "Today's Lowers tune",
  },
  {
    icon: Mountain,
    title: "Upstream & history",
    body: "Wickiup Reservoir storage, canal diversions, and past flows, for a sense of what the river is likely to do next.",
    tab: "historical",
    cta: "Explore history",
  },
];

export const AboutSection: React.FC<AboutSectionProps> = ({ onNavigate }) => {
  const go = (tab: ActiveTab) => {
    onNavigate(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section
      aria-labelledby="about-title"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm"
    >
      <h2
        id="about-title"
        className="font-outfit font-bold text-xl sm:text-2xl text-slate-900 tracking-tight"
      >
        Thinking about surfing the wave in Bend, Oregon?
      </h2>
      <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
        Bend Surf Report brings together everything a river surfer needs to decide whether to head
        to the Bend Whitewater Park on the Deschutes River: a live surf cam, flow at the wave, water
        temperature, weather and air quality, all in one place and refreshed every few minutes.
      </p>

      <ul className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body, tab, cta }) => (
          <li key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
              <h3 className="font-bold text-sm text-slate-900">{title}</h3>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed flex-1">{body}</p>
            <button
              type="button"
              onClick={() => go(tab)}
              className="mt-3 self-start inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
            >
              {cta}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
        Flows on this stretch of the Deschutes are set largely by Wickiup Reservoir releases and
        irrigation diversions in Bend, so conditions at the wave can change within hours. Check
        here before you go.
      </p>
    </section>
  );
};
