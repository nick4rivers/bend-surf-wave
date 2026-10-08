import React from "react";
import { Video, ExternalLink } from "lucide-react";
import { SurfDataResponse } from "../types";

interface RiverWebcamProps {
  data: SurfDataResponse;
}

const CHANNEL_EMBED_URL = "https://www.youtube.com/embed/live_stream?channel=UC5NGBccFc9inD-62NMKGtVg";
const CHANNEL_STREAMS_URL = "https://www.youtube.com/@bendbulletin/streams";

export const RiverWebcam: React.FC<RiverWebcamProps> = ({ data }) => {
  const cam = data.webcams?.[0];
  const rawEmbedUrl = cam?.embedUrl || CHANNEL_EMBED_URL;
  const embedUrl = /[?&](autoplay|mute)=/.test(rawEmbedUrl)
    ? rawEmbedUrl
    : `${rawEmbedUrl}${rawEmbedUrl.includes("?") ? "&" : "?"}autoplay=0&mute=1`;
  const channelUrl = cam?.channelUrl || CHANNEL_STREAMS_URL;
  const watchUrl = cam?.watchUrl || channelUrl;
  const isLive = cam?.isLive ?? null;

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

      <div className="mt-4">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
          {/* Always show the player: YouTube itself says "offline" if the stream is down,
              and our server-side check can be wrong, so it must never hide a working stream. */}
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="Bend Whitewater Park Live Stream - The Bulletin"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {isLive === true && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {isLive === false && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            {isLive === null && <span className="w-2 h-2 rounded-full bg-slate-400" />}
            <span className="font-medium text-slate-700">
              {isLive === true ? "Live" : isLive === false ? "Stream may be offline" : "Live cam"}
            </span>
            <span className="text-slate-400">· via The Bulletin</span>
          </div>

          <a
            href={watchUrl}
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
