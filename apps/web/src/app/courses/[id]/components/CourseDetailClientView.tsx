// app/courses/[id]/components/CourseDetailClientView.tsx
'use client';

import CourseDetailDesktopView from './desktop-view';
import CourseDetailMobileView from './mobile-view';
import useMediaQuery from '@/hooks/useMediaQuery'; // or your own matchMedia hook
import type { ICourseResponse } from '@elearning/types';

interface Props {
  course: ICourseResponse;
  playlistUrl: string;
}


export default function CourseDetailClientView({ course, playlistUrl }: Props) {
 

  const isDesktop = useMediaQuery('(min-width: 768px)');

  return isDesktop ? (
    <CourseDetailDesktopView course={course} playlistUrl={playlistUrl} />
  ) : (
    <CourseDetailMobileView  course={course} playlistUrl={playlistUrl} />
  );
}
