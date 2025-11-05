"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward } from "lucide-react"

interface CustomYouTubePlayerProps {
  videoId: string
  autoplay?: boolean
  loop?: boolean
}

export default function CustomYouTubePlayer({ videoId, autoplay = false, loop = false }: CustomYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [isPlaying, setIsPlaying] = useState(autoplay)
  const [isMuted, setIsMuted] = useState(autoplay)
  const [volume, setVolume] = useState(100)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isControlsVisible, setIsControlsVisible] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerStateRef = useRef<{
    isReady: boolean
    isPlaying: boolean
    isMuted: boolean
    volume: number
    currentTime: number
    duration: number
  }>({
    isReady: false,
    isPlaying: autoplay,
    isMuted: autoplay,
    volume: 100,
    currentTime: 0,
    duration: 0,
  })

  // Post message to YouTube iframe
  const postMessageToYouTube = (action: string, value?: any) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return

    const data = {
      event: "command",
      func: action,
      args: value !== undefined ? [value] : [],
    }

    try {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(data), "*")
    } catch (error) {
      console.error("Error posting message to YouTube iframe:", error)
    }
  }

  // Initialize player and set up message listeners
  useEffect(() => {
    // Set up message listener for YouTube iframe API
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return

      try {
        const data = JSON.parse(event.data)

        // Handle YouTube player events
        if (data.event === "onReady") {
          playerStateRef.current.isReady = true

          // Start progress tracking
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
          }

          progressIntervalRef.current = setInterval(() => {
            postMessageToYouTube("getCurrentTime")
            postMessageToYouTube("getDuration")
          }, 500)

          // Set initial state
          if (autoplay) {
            postMessageToYouTube("playVideo")
          }
        } else if (data.event === "onStateChange") {
          // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: video cued
          setIsPlaying(data.info === 1)
          playerStateRef.current.isPlaying = data.info === 1
        } else if (data.event === "onPlaybackQualityChange") {
          // Handle quality change if needed
        } else if (data.event === "onError") {
          console.error("YouTube player error:", data.info)
        } else if (data.event === "infoDelivery") {
          // Handle info delivery (getCurrentTime, getDuration, etc.)
          if (data.info && data.info.currentTime !== undefined) {
            const time = Number.parseFloat(data.info.currentTime)
            setCurrentTime(time)
            playerStateRef.current.currentTime = time
          }

          if (data.info && data.info.duration !== undefined) {
            const dur = Number.parseFloat(data.info.duration)
            setDuration(dur)
            playerStateRef.current.duration = dur

            // Update progress
            if (playerStateRef.current.currentTime && dur) {
              const prog = (playerStateRef.current.currentTime / dur) * 100
              setProgress(prog)
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors for non-JSON messages
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [autoplay, videoId])

  // Format time in MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  // Handle play/pause
  const togglePlay = () => {
    if (isPlaying) {
      postMessageToYouTube("pauseVideo")
    } else {
      postMessageToYouTube("playVideo")
    }
    setIsPlaying(!isPlaying)
    playerStateRef.current.isPlaying = !isPlaying
  }

  // Handle mute/unmute
  const toggleMute = () => {
    if (isMuted) {
      postMessageToYouTube("unMute")
      postMessageToYouTube("setVolume", volume)
    } else {
      postMessageToYouTube("mute")
    }
    setIsMuted(!isMuted)
    playerStateRef.current.isMuted = !isMuted
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseInt(e.target.value)
    setVolume(newVolume)
    playerStateRef.current.volume = newVolume

    postMessageToYouTube("setVolume", newVolume)

    if (newVolume === 0) {
      postMessageToYouTube("mute")
      setIsMuted(true)
      playerStateRef.current.isMuted = true
    } else if (isMuted) {
      postMessageToYouTube("unMute")
      setIsMuted(false)
      playerStateRef.current.isMuted = false
    }
  }

  // Handle progress bar change
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number.parseFloat(e.target.value)
    setProgress(newProgress)

    const newTime = (newProgress / 100) * duration
    postMessageToYouTube("seekTo", newTime)
  }

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.error("Error attempting to enable fullscreen:", err)
        })
      } else {
        document.exitFullscreen()
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
    }
  }

  // Update fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Handle controls visibility
  useEffect(() => {
    const showControls = () => {
      setIsControlsVisible(true)

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }

      controlsTimeoutRef.current = setTimeout(() => {
        if (playerStateRef.current.isPlaying) {
          setIsControlsVisible(false)
        }
      }, 3000)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", showControls)
      container.addEventListener("mouseenter", showControls)
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", showControls)
        container.removeEventListener("mouseenter", showControls)
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Skip forward/backward
  const skipForward = () => {
    const newTime = Math.min(currentTime + 10, duration)
    postMessageToYouTube("seekTo", newTime)
  }

  const skipBackward = () => {
    const newTime = Math.max(currentTime - 10, 0)
    postMessageToYouTube("seekTo", newTime)
  }

  // Build YouTube embed URL with parameters
  const getYouTubeEmbedUrl = () => {
    const params = new URLSearchParams({
      enablejsapi: "1",
      autoplay: autoplay ? "1" : "0",
      mute: autoplay ? "1" : "0",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      showinfo: "0",
      loop: loop ? "1" : "0",
      playlist: loop ? videoId : "",
      playsinline: "1",
      origin: typeof window !== "undefined" ? window.location.origin : "",
    })

    return `https://www.youtube.com/embed/QaMMWRpwOhE?autoplay=1&mute=1&loop=1&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* YouTube iframe container with scaling to hide branding */}
      <div className="absolute inset-0 w-[300%] -ml-[100%] overflow-hidden pointer-events-none">
        <iframe
          ref={iframeRef}
          src={getYouTubeEmbedUrl()}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300 ${
          isControlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 p-4">
          <div className="text-white text-sm font-medium opacity-80">Custom Player</div>
        </div>

        {/* Center play/pause button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-2">
          {/* Progress bar */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-white text-xs">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              aria-label="Video progress"
            />
            <span className="text-white text-xs">{formatTime(duration)}</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={skipBackward}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label="Skip backward 10 seconds"
              >
                <SkipBack size={20} />
              </button>

              <button
                onClick={togglePlay}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <button
                onClick={skipForward}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward size={20} />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-300 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  aria-label="Volume"
                />
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

