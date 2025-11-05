'use client';

import React, { lazy, Suspense } from 'react';
import { CourseCard } from '@/components/course-card';
import { ICourseResponse } from '@elearning/types';

const HomeInstructor = lazy(() => import('@/components/home-instructor'));

interface CourseItemProps {
  course: ICourseResponse;
  eagerLoad?: boolean;
}

export default function CourseItem({ course, eagerLoad = true }: CourseItemProps) {
  const { instructor } = course;

  return (
    <div
      style={{
        boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
      }}
      className="w-full bg-white md:w-[600px] mx-auto rounded-tl-[9px] rounded-tr-[9px] rounded-bl-[13px] rounded-br-[13px]"
    >
      {/* Wrap lazy-loaded component in Suspense */}
      <Suspense fallback={null}>
        <HomeInstructor instructor={instructor} />
      </Suspense>

      {/* You can pass eagerLoad to CourseCard or use it here */}
      <CourseCard course={course} eagerLoad={eagerLoad} />
    </div>
  );
}
