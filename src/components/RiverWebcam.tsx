import React from "react";
import { Video, ExternalLink } from "lucide-react";
import { SurfDataResponse } from "../types";

interface RiverWebcamProps {
  data: SurfDataResponse;
}

export const RiverWebcam: React.FC<RiverWebcamProps> = ({ data }) => {
  const primaryCam = data.webcams?.[0];
  const rawEmbedUrl = primaryCam?.embedUrl || "https://www.youtube.com/embed/r_HxcmGwYNA";
  const embedUrl = rawEmbedUrl.includes("?")
    ? rawEmbedUrl
    : `${rawEmbedUrl}?autoplay=0&mute=1`;

  const videoIdMatch = rawEmbedUrl.match(/embed\/([^?&]+)/);
  const liveWatchUrl = videoIdMatch
    ? `https://www.youtube.com/live/${videoIdMatch[1]}`
    : "https://www.youtube.com/live/r_HxcmGwYNA";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
            Live River &amp; Surf Webcam
          </h3>
        </div>
      </div>

      {/* Video Player / Stream Embed Area */}
      <div className="mt-4">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
          <iframe
            src={embedUrl}
            title="Bend Whitewater Park Live Stream - The Bend Bulletin"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-700">Live Cam</span>
          </div>

          <a
            href={liveWatchUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 transition"
          >
            <span>Open on YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
