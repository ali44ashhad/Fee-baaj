import axios from 'axios';
import { Request, Response } from 'express';
import config from '@/config';

const { BUNNY_VIDEO_LIBRARY_ID, BUNNY_STREAM_API_KEY } = config.bunny;
const bunnyApiUrl = 'https://video.bunnycdn.com';
const libraryId = BUNNY_VIDEO_LIBRARY_ID;

// Simple in-memory cache
type CacheEntry = { ts: number; playlistUrl: string };
const manifestCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const streamVideo = async (req: Request, res: Response) => {
  try {
    const videoId = req.params.videoId;

    // 1. Check in-memory cache first
    const cached = manifestCache.get(videoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      // serve cached
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      return res.json({ playlistUrl: cached.playlistUrl });
    }

    // 2. Fetch fresh from Bunny
    const videoPlayUrl = `${bunnyApiUrl}/library/${libraryId}/videos/${videoId}/play?expires=100000`;
    const { data: videoData } = await axios.get(videoPlayUrl, {
      headers: {
        accept: 'application/json',
        AccessKey: BUNNY_STREAM_API_KEY,
      },
    });

    if (!videoData?.videoPlaylistUrl && !videoData?.fallbackUrl) {
      return res.status(404).json({ error: "Video or Playlist URL not found" });
    }

    const playlistUrl = videoData.videoPlaylistUrl || videoData.fallbackUrl;

    // 3. Store in cache
    manifestCache.set(videoId, { ts: Date.now(), playlistUrl });

    // 4. Set HTTP cache headers
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

    return res.json({ playlistUrl });
  } catch (error) {
    console.error("Error in streamVideo:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
