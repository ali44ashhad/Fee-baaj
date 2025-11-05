// src/components/HlsVideoPlayer.tsx
import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";

interface HlsVideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "" ;
}

const isProbablyHls = (url: string) => {
  if (!url) return false;
  // remove query string and fragment then check extension
  try {
    const cleaned = url.split("?")[0].split("#")[0];
    return cleaned.toLowerCase().endsWith(".m3u8");
  } catch {
    return url.toLowerCase().includes(".m3u8");
  }
};

const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  src,
  className,
  autoPlay = false,
  crossOrigin = "anonymous",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hlsError, setHlsError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setHlsError(null);

    // ensure video has proper crossOrigin if needed (helps with CORS)
    if (crossOrigin) video.crossOrigin = crossOrigin;

    const wantHls = isProbablyHls(src);

    // Clean previous hls instance if any
    const cleanup = () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          // safe ignore
        }
        hlsRef.current = null;
      }
    };

    cleanup();

    // If browser supports MSE and Hls.js and we have an m3u8 -> use hls.js
    if (Hls.isSupported() && wantHls) {
      const hls = new Hls({
        // optional config: enableWorker: true, debug: true
      });
      hlsRef.current = hls;

      const onError = (_evt: any, data: any) => {
        console.error("hls.js error", data);
        // show a helpful message to the user for fatal errors
        if (data && data.fatal) {
          // attempt recovery for common error types first
          const { type, details } = data;
          if (type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.warn("Network error, trying to restart load...");
            hls.startLoad();
            return;
          } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.warn("Media error, trying recoverMediaError...");
            hls.recoverMediaError();
            return;
          } else {
            console.error("Fatal HLS error — destroying hls instance.");
            setHlsError(`Fatal HLS error: ${details || "unknown"}`);
            hls.destroy();
            hlsRef.current = null;
            return;
          }
        }
      };

      hls.on(Hls.Events.ERROR, onError);

      hls.loadSource(src);
      hls.attachMedia(video);

      // optional: react to manifest parsed and try to autoplay
      const onManifestParsed = () => {
        console.info("HLS manifest parsed");
        if (autoPlay) {
          video
            .play()
            .then(() => console.info("Autoplay succeeded"))
            .catch((err) =>
              console.warn("Autoplay prevented (user gesture required)", err)
            );
        }
      };
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);

      // cleanup on unmount or src change
      return () => {
        hls.off(Hls.Events.ERROR, onError);
        hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
        cleanup();
      };
    } else {
      // Fallback to native playback (Safari or non-hls.js browsers)
      // native playback supports m3u8 on Safari
      // set src directly and let browser handle it
      video.src = src;

      const onVideoError = (ev: any) => {
        console.error("Native video error", ev);
        setHlsError("Native video playback failed. Check network/CORS/format.");
      };
      video.addEventListener("error", onVideoError);

      if (autoPlay) {
        video
          .play()
          .then(() => {})
          .catch((e) =>
            console.warn("Autoplay prevented on native playback", e)
          );
      }

      return () => {
        video.removeEventListener("error", onVideoError);
        // clear src
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {}
      };
    }
  }, [src, autoPlay, crossOrigin]);

  return (
    <div className="hls-player-container">
      {hlsError && (
        <div className="p-2 mb-2 text-sm text-red-700 bg-red-100 border border-red-200 rounded">
          Playback Failed: {hlsError}
        </div>
      )}

      <video
        ref={videoRef}
        controls
        preload="metadata"
        className={className}
        // key not required unless you want full remount behavior
      >
        Your browser doesn't support the video element or the HLS format.
      </video>
    </div>
  );
};

export default HlsVideoPlayer;
