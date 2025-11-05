'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import MessengerIcon from '@/assets/messenger.png';
import { ICourseResponse } from '@elearning/types';
import VideoPlayer from "../../../../../courses/[id]/components/VideoPlayer"
import Image from 'next/image';

interface MyCourseDetailsProps {
  course: ICourseResponse;
}

export default function MyCourseMobileViewDetails({ course }: MyCourseDetailsProps) {
  return (
    <div>
     <VideoPlayer videoPopups={course.videoPopups} videoId={course.bunnyVideoId}/>
      <div className="bg-gradient-to-r from-[#1C1D1F] to-[#3C0138] text-white shadow-2xl">
        <div className="px-4 py-2">
          <div className="flex items-center gap-1.5 text-light-yellow">
            <Star className="w-4 h-4 fill-light-yellow text" />{' '}
            <span className="font-semibold">Lecture 1 (HD Video)</span>
          </div>
          <h1 className="text-xl font-semibold mt-1">{course.title}</h1>
          <div className="flex items-center gap-4 my-2">
            <div className="bg-gradient-to-r from-light-purple to-dark-purple px-4 py-1 flex justify-between items-center">
              <div className="flex gap-1.5 items-center">
                <Image src={course.instructor.picture} alt="" width={40} height={40} className="rounded-full w-5 h-5" />
                <span className="font-semibold">Message সাদমান ভাই</span>
              </div>
            </div>
            <button className="flex items-center gap-1.5">
              <Image src={MessengerIcon} alt="Message" width={20} height={20} />
              <span className="font-semibold">Private গ্রুপ</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">America থেকে একদম Free হেল্প করতে চাই!</div>
            <button className="bg-[#4B0762] shadow-xl px-2 py-0.5">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
