'use client';

import { useState, useCallback, useEffect } from 'react';
import { ICourseResponse } from '@elearning/types';
import Chapters from './chapters';
import { CheckIcon, GraduationCap } from 'lucide-react';
import Reviews from './reviews';
import Objectives from './objectives';
import { StarRating } from '@/components/star-rating';
import Instructor from './instructor';
import Image from 'next/image';
import { TrophyIcon } from '@/lib/icons';
import Enroll from './enroll';
import VideoPlayer from './VideoPlayer';
import SocialIconsBar from './social-icons-bar';
import { convertToBengaliDigits } from '@/lib/convertToBengaliDigits';
import { AuthPopup } from '@/app/auth/components/auth-popup';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import InstructorCard from '@/components/instructor-drag';
import './mobileview.styles.css';

import { formatCompactNumber } from '@/lib/formatNumber';

interface CourseDetailMobileViewProps {
  course: ICourseResponse;
  playlistUrl?: string; // optional; we will compute if not provided
}

const url = process.env.NEXT_PUBLIC_API_URL;
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || process.env.NEXT_PUBLIC_MEDIA_API_URL || '';

export default function CourseDetailMobileView({
  course,
  playlistUrl: initialPlaylistUrl,
}: CourseDetailMobileViewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const { display, instructor, bunnyVideoId, videoPopups, price, originalPrice } = course;

  // compute image source
  const imageSource = instructor?.pictureUrl ? instructor?.pictureUrl : '/userPlaceHolder.jpg';

  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const handleMessageClick = useCallback(() => {
    const idStr = String((instructor as any).id ?? (instructor as any)._id ?? '');
    if (isAuthenticated) {
      router.push(`/chat/instructor/${idStr}`);
    } else {
      setAuthMode('login');
      setIsDialogOpen(true);
    }
  }, [isAuthenticated, instructor, router]);

  // Build proxied HLS url (instant fallback)
  const courseId = (course as any).id ?? (course as any)._id ?? '';
  const proxiedHlsUrl = (cId: string) =>
    `${MEDIA_URL?.replace(/\/$/, '') || ''}/api/media/hls?courseId=${encodeURIComponent(cId)}&isIntro=true`;

  // Try to fetch playback-url from media server, otherwise use proxied HLS.
  useEffect(() => {
    if (!courseId) {
      // no id -> nothing to do
      setPlaylistUrl(initialPlaylistUrl ?? '');
      return;
    }

    const initial = initialPlaylistUrl || proxiedHlsUrl(courseId);
    // set immediate fallback so VideoPlayer can begin
    setPlaylistUrl(initial);

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        // Prefer the media server playback-url endpoint (may return CDN url)
        const params = new URLSearchParams({ courseId: courseId, isIntro: 'true' });
        const playbackEndpoint = `${MEDIA_URL.replace(/\/$/, '')}/api/media/playback-url?${params.toString()}`;

        const res = await fetch(playbackEndpoint, {
          signal: controller.signal,
          // client-side fetch: no caching or you can control it as needed
          cache: 'no-store',
          credentials: 'include',
        });

        if (!res.ok) {
          // fallback to proxied HLS already set
          // eslint-disable-next-line no-console
          console.warn(`playback-url responded ${res.status}, using proxied HLS`);
          return;
        }

        const json = await res.json();
        const candidate = (json && (json.playlistUrl ?? json.url ?? json.data?.url ?? json.data?.playlistUrl)) || null;

        if (!cancelled && candidate && candidate !== playlistUrl) {
          setPlaylistUrl(candidate);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        // keep proxied HLS as fallback
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch playback-url, using proxied HLS fallback:', err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, initialPlaylistUrl]); // only re-run when course id or parent-provided url changes

  return (
    <>
      <Instructor instructor={course.instructor} display={display} />

      <div className="h-[467px] tiny:h-[282px] xs:h-[428px] sm-custom:h-[467px]">
        <VideoPlayer
          shouldPlay
          playlistUrl={course.videoStatus.playbackUrl }
          videoPopups={videoPopups as any[]}
          videoId={bunnyVideoId as string}
        />
      </div>

      <div className="px-4 py-2 flex justify-between items-center">
        <SocialIconsBar
          display={display}
          instructorImage={instructor.pictureId}
          courseId={course._id}
          userReaction={course.userReaction}
          initialReactions={course.reactions}
        />
      </div>

      <div className="bg-gradient-to-r from-[#1C1D1F] to-[#3C0138] py-1 text-white shadow-2xl">
        <div className="px-4 py-2">
          <h1 className="tiny:text-[19px] xs:text-[21px] text-[23px] font-bold">{course.title}</h1>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[15px] text-light-yellow">{formatCompactNumber(display.rating)}</span>
            <StarRating size="lg" rating={Number(display.rating)} />
            <span className="text-[15px] text-light-yellow font-semibold">({formatCompactNumber(display.reviews)} Reviews)</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-light-purple to-dark-purple text-white px-3 py-1 flex gap-2 justify-between items-center">
          <div className="flex gap-1 items-center">
            <GraduationCap className="tiny:w-[17px] tiny:h-[17px] w-[20px] h-[20px]" />
            <span className="font-semibold whitespace-nowrap tiny:text-[13px] text-[16px]">
              {formatCompactNumber(display.students)} student কোর্সে
            </span>
          </div>

          <div onClick={handleMessageClick} className="flex gap-1 items-center cursor-pointer">
            <div className="tiny:w-[23px]  tiny:h-[23px] w-[26px] h-[26px] rounded-full bg-gray-100 overflow-hidden">
              <Image src={imageSource} alt="Instructor" width={26} height={26} className="object-cover w-full h-full" />
            </div>
            <span className="font-semibold  whitespace-nowrap tiny:text-[13px] text-[16px]">Message সাদমান ভাই</span>
          </div>
        </div>

        <div
          style={{ fontSize: 'clamp(0.8rem, 1.4vw, 1.3rem)' }}
          className="grid whitespace-nowrap grid-cols-2 gap-x-[10vw] gap-y-2 px-4 py-2 text-sm"
        >
          <div className="flex gap-1 items-center">
            <CheckIcon className="w-4 h-4 text-light-yellow" />
            <span className="font-semibold">Life-Time access</span>
          </div>
          <div className="flex gap-1 items-center">
            <TrophyIcon className="w-4 h-4 fill-light-yellow" />
            <span className="font-semibold">Free certificate</span>
          </div>
          <div className="flex gap-1 items-center">
            <Image src="/group.svg" alt="group" width={16} height={16} />
            <span className="font-semibold">Free private groups</span>
          </div>
          <div className="flex gap-1 items-center">
            <Image src="/exclam.svg" alt="support" width={20} height={20} />
            <span className="font-semibold">Free Full Support</span>
          </div>
        </div>
      </div>

      <div className="p-2 shadow-2xl z-50 border-t fixed bottom-0 left-0 w-full bg-white">
        <div className="flex items-start gap-2">
          <div>
            <div
              className="bg-primary text-[19px] text-white px-1 whitespace-nowrap py-1 rounded font-bold"
              style={{ letterSpacing: '3%' }}
            >
              {price > 0 ? '99% Free' : '100% Free'}
            </div>
            <div className="line-through whitespace-nowrap text-[19px] text-gray-500">
              টাকা {convertToBengaliDigits(originalPrice)}
            </div>
            {price > 0 && (
              <div className="text-gray-500 text-[19px] mt-[-5px]">মাত্র {convertToBengaliDigits(price)}</div>
            )}
          </div>
          <div className="flex-1 self-stretch flex items-start">
            <Enroll course={course} />
          </div>
        </div>
      </div>

      <div className="px-2">
        <Chapters chapters={course.chapters} videoId={bunnyVideoId} />
        <Reviews course={course} />
        <Objectives objectives={course.objectives} />
      </div>

      <AuthPopup
        authMode={authMode}
        setAuthMode={setAuthMode}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
      <InstructorCard
        instructorName={course?.instructor?.name}
        instructorProfession={course?.instructor.profession}
        profilePicUrl={course?.instructor?.pictureUrl}
        initialVisible={true}
        instructorId={course?.instructor?._id as string}
      />
    </>
  );
}
