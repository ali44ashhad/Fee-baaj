'use client';

import React, { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import axios from 'axios';
import VideoPlayer from '@/app/courses/[id]/components/VideoPlayer';

interface LazyVideoPlayerProps {
  bunnyVideoId: string;
  videoPopups: {
    id?: string;
    link: string;
    popupDuration?: number;
    triggerAt?: number;
  }[];
}

export default function LazyVideoPlayer({ bunnyVideoId, videoPopups }: LazyVideoPlayerProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '10px' });
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // Track whether the video is playing
  const [isVideoLoaded, setIsVideoLoaded] = useState(false); // Track if video is loaded

  useEffect(() => {
    // Load the video playlist when the video comes into view
    if (inView && !playlistUrl) {
      axios
        .get(`${process.env.NEXT_PUBLIC_API_URL}/video/stream/${bunnyVideoId}`, { withCredentials: true })
        .then(res => {
          setPlaylistUrl(res.data.playlistUrl);
          setIsVideoLoaded(true); // Mark video as loaded once the URL is fetched
        })
        .catch(console.error);
    }
  }, [inView, bunnyVideoId, playlistUrl]);

  useEffect(() => {
    if (inView && isVideoLoaded) {
      setIsVideoPlaying(true); // Play video when it's in view and loaded
    } else {
      setIsVideoPlaying(false); // Stop the video when it's out of view
    }
  }, [inView, isVideoLoaded]);

  return (
    <div>
      
    </div>
  );
}
