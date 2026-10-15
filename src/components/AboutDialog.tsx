import React, { useRef } from "react";
import { Info, X } from "lucide-react";

// "About" button + popup. The <dialog> is always rendered (just closed), so its text,
// including the page's <h1>, is in the HTML Google indexes even though visitors
// only see it when they tap the button. Keeps the surf report as the first thing on screen.
export const AboutDialog: React.FC = () => {
  const ref = useRef<HTMLDialogElement>(null);

  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label="About Bend Surf Report"
        title="About"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition"
      >
        <Info className="w-[18px] h-[18px]" aria-hidden="true" />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="about-dialog-title"
        // Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
      >
        <div className="relative p-6 sm:p-7 space-y-2">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
          <h1
            id="about-dialog-title"
            className="font-outfit font-bold text-2xl text-slate-900 tracking-tight leading-tight pr-8"
          >
            Bend Surf Cam &amp; Surf Report
          </h1>
          <p className="text-base font-semibold text-sky-700 leading-snug">
            Live conditions at the Bend Whitewater Park surf wave
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Check the Bend surf cam, current river flow, wave conditions, water temperature and
            weather before heading to the Deschutes River.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed pt-2">
            Data refreshes every few minutes. Flow at the wave is modeled from the USGS Benham Falls
            gage upstream, minus irrigation canal diversions, so treat it as an estimate.
          </p>
        </div>
      </dialog>
    </>
  );
};
