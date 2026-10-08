import React from "react";
import { Video, ExternalLink, VideoOff } from "lucide-react";
import { SurfDataResponse } from "../types";

interface RiverWebcamProps {
  data: SurfDataResponse;
}

const FALLBACK_VIDEO_ID = "kMjtqZC1_qI"; // keep in sync with api/_lib/webcam.ts
const CHANNEL_STREAMS_URL = "https://www.youtube.com/@bendbulletin/streams";

export const RiverWebcam: React.FC<RiverWebcamProps> = ({ data }) => {
  const cam = data.webcams?.[0];
  const rawEmbedUrl = cam?.embedUrl || `https://www.youtube.com/embed/${FALLBACK_VIDEO_ID}`;
  const embedUrl = rawEmbedUrl.includes("?") ? rawEmbedUrl : `${rawEmbedUrl}?autoplay=0&mute=1`;
  const videoId = rawEmbedUrl.match(/embed\/([^?&]+)/)?.[1] ?? FALLBACK_VIDEO_ID;
  const watchUrl = cam?.watchUrl || `https://www.youtube.com/watch?v=${videoId}`;
  const channelUrl = cam?.channelUrl || CHANNEL_STREAMS_URL;
  const isLive = cam?.isLive ?? null;
  const offline = isLive === false;

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
          {offline ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
              <VideoOff className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-semibold">The park cam stream is offline right now.</p>
              <p className="text-xs text-slate-400 max-w-xs">
                The Bulletin restarts it from time to time; it will reappear here automatically once it's back.
              </p>
              <a
                href={channelUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200 flex items-center gap-1"
              >
                Check The Bulletin's live streams <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <iframe
              key={videoId}
              src={embedUrl}
              title="Bend Whitewater Park Live Stream - The Bulletin"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {isLive === true && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {isLive === false && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            {isLive === null && <span className="w-2 h-2 rounded-full bg-slate-400" />}
            <span className="font-medium text-slate-700">
              {isLive === true ? "Live" : isLive === false ? "Offline" : "Live cam"}
            </span>
            <span className="text-slate-400">· via The Bulletin</span>
          </div>

          <a
            href={offline ? channelUrl : watchUrl}
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
