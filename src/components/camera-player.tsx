"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Video, VideoOff, RefreshCw, Maximize, Volume2, VolumeX } from "lucide-react";

export function CameraPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [muted, setMuted] = useState(true);

  const loadStream = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/camera");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { url } = await res.json();
      const video = videoRef.current;
      if (!video || !url) return;

      // Clean up previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setStatus("playing");
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setStatus("error");
            setErrorMsg("Stream connection lost");
            hls.destroy();
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
          setStatus("playing");
        });
      } else {
        setStatus("error");
        setErrorMsg("HLS not supported in this browser");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to load stream");
    }
  }, []);

  useEffect(() => {
    loadStream();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [loadStream]);

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (video) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        video.requestFullscreen();
      }
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setMuted(video.muted);
    }
  };

  return (
    <div className="relative w-full h-full group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        autoPlay
        muted
        playsInline
      />

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
          <RefreshCw className="w-10 h-10 animate-spin mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to camera...</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
          <VideoOff className="w-12 h-12 mb-4 text-red-400" />
          <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
          <button
            onClick={loadStream}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      {status === "playing" && (
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={loadStream}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
                title="Refresh stream"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/20 transition text-white"
                title="Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
