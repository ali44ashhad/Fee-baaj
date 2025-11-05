// app/home/components/CourseCard.tsx
'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect, Suspense } from 'react';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Skeleton from 'react-loading-skeleton';
import CourseHeader from './home-courseInfo';
import HomeSocialIconsBar from './home-lg-socialBar';
import webRoutes from '@/lib/webRoutes';
import type { ICourseResponse } from '@elearning/types';

const VideoPlayer = dynamic(
  () => import('@/app/courses/[id]/components/VideoPlayer'),
  { ssr: false }
);

interface CourseCardProps {
  course: ICourseResponse;
  eagerLoad?: boolean;
}

export function CourseCard({ course, eagerLoad = true }: CourseCardProps) {
  const {
    id,
    slug,
    bunnyVideoId,
    videoPopups = [],
    display,
    premium,
    originalPrice,
    price,
    title,
    thumbnailId,
    playlistUrl,
  } = course;

  // Intersection observer: only start playing when in view
  const { ref, inView } = useInView({
    triggerOnce: false,
    root: null,             // viewport
    rootMargin: '0px',      // don't expand the root area
    threshold: 0.6,         // require 60% of the element visible
  });
  // mounted => true only after client mount. Helps avoid SSR mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Play state: controlled by intersection + eagerLoad setting, but only after mount
  const [shouldPlay, setShouldPlay] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    setShouldPlay(eagerLoad ? true : inView);
  }, [inView, eagerLoad, mounted]);

  const imageSource = thumbnailId
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || ''}/images/${thumbnailId}`
    : '/youtube.jpg';

  return (
    <div
      className="overflow-hidden md:rounded-bl-[13px] md:rounded-br-[13px] 
                  shadow-sm hover:shadow-md transition-shadow"
    >
      {/* VIDEO HERO */}
      <div
        ref={ref}
        className="relative px-0 py-0 md:px-[70px] bg-black flex justify-center
                  h-[480px] tiny:h-[282px] xs:h-[428px] sm-custom:h-[480px] md:h-[500px] overflow-hidden"
        style={{ contentVisibility: 'auto' }}
      >
        {mounted  && (
          // client-only VideoPlayer — loaded dynamically, no SSR
          <Suspense fallback={<div className="w-full h-full bg-black m-0 p-0"><Skeleton height="100%" /></div>}>
            <VideoPlayer
              videoId={String(bunnyVideoId || '')}
              playlistUrl={String(course?.videoStatus?.playbackUrl)}
              videoPopups={videoPopups}
              shouldPlay={shouldPlay}
            />
          </Suspense>
        ) }
      </div>
 
      {/* SOCIAL BAR + HEADER */}
      <div className="deferred-content">
        <HomeSocialIconsBar display={display} courseId={id} reactions={course.reactions} userReaction={course.userReaction} />
        <Link href={webRoutes.courseDetails(slug)}>
       
            <CourseHeader
              views={display?.views}
              premium={premium}
              originalP={originalPrice}
              price={price}
              display={display}
              title={title}
            />
         
        </Link>
      </div>
    </div>
  );
}

export default CourseCard;
