import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/apiClient';
// Assuming the path to your new HlsVideoPlayer component
import HlsVideoPlayer from '@/components/ui/HlsPlayer'; 

interface Props {
  courseId: string;
  lectureId?: string | null;            // required when type === 'lecture'
  type?: 'intro' | 'lecture';           // default 'intro'
  pollIntervalMs?: number;              // default 3000
}

export default function CourseEditStatus({
  courseId,
  lectureId = null,
  type = 'intro',
  pollIntervalMs = 3000,
}: Props) {
  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>(`/courses/${courseId}`);
      setCourse(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch course status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
    const t = setInterval(fetchCourse, pollIntervalMs);
    return () => clearInterval(t);
    // note: courseId and pollIntervalMs are dependencies only (lectureId change usually handled by remount)
  }, [courseId, pollIntervalMs]);

  if (error && !course) return <div className="text-red-600">Error: {error}</div>;
  if (!course) return <div>Loading status…</div>;

  // Decide which videoStatus to show
  let vs: any = course.videoStatus || {};
  let playback = '';

  if (type === 'lecture' && lectureId) {
    const chapters = course.chapters || [];
    let foundLecture: any = null;
    for (const ch of chapters) {
      if (!ch || !ch.lectures) continue;
      const match = (ch.lectures || []).find(
        (l: any) =>
          String(l._id) === String(lectureId) ||
          String(l.id) === String(lectureId)
      );
      if (match) {
        foundLecture = match;
        break;
      }
    }
    if (foundLecture) {
      vs = foundLecture.videoStatus || vs;
    } else {
      // fallback to course videoStatus (prevents crashes if lecture not yet returned by API)
    }
  }

  // NOTE: This line constructs the playback URL based on the video status
  playback = vs.playbackUrl || (vs.s3Prefix ? `${import.meta.env.VITE_S3_CDN_URL || ''}/${vs.s3Prefix}/master.m3u8` : '');

  const step = vs.step || 'none';
  const pct = typeof vs.pct === 'number' ? vs.pct : 0;

  return (
    <div className="p-3 border rounded bg-white">
      <div className="text-sm text-gray-700 mb-2">
        <strong>{type === 'lecture' ? 'Lecture video status:' : 'Course intro status:'}</strong> {step} — {pct}%
      </div>

      <div className="w-full bg-gray-100 rounded h-2 mb-2 overflow-hidden">
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} className="h-2 bg-blue-600" />
      </div>

      {vs.error && <div className="text-sm text-red-600 mb-2">Error: {vs.error}</div>}

      {/* --- Using the new HlsVideoPlayer Component --- */}
      {playback ? (
        <div className="mt-4 border rounded-lg overflow-hidden shadow-md transition-all duration-300">
          <div className="p-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">Video Playback Preview</div>
          <div className="p-3">
            <HlsVideoPlayer
              src={playback}
              className="w-full h-auto max-h-96 rounded-md bg-black"
            />
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 mt-2">No playback URL yet. Video processing in progress.</div>
      )}
      {/* ----------------------------------------------- */}
    </div>
  );
}