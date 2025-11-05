'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import MessengerIcon from '@/assets/messenger.png';
import { ICourseResponse } from '@elearning/types';
// import VideoPlayer from '@/app/courses/[id]/components/youtube-player';
import VideoPlayer from "../../../../../courses/[id]/components/VideoPlayer"
import Image from 'next/image';

interface MyCourseDetailsProps {
  course: ICourseResponse;
}

export default function MyCourseMobileViewDetails({ course }: MyCourseDetailsProps) {
  return (
    <div className="w-full">
      <div className="grid md:grid-cols-[2fr_1fr] lg:grid-cols-[3fr_1fr] h-full">
        <div className="h-full">
        <VideoPlayer videoPopups={course.videoPopups} videoId={course.bunnyVideoId}/>
        </div>

        <div className="bg-gradient-to-r from-[#1C1D1F] to-[#3C0138] text-white shadow-2xl h-full">
          <div className="p-6 flex flex-col justify-between h-full">
            <div className="">
              <div className="flex items-center gap-2 text-light-yellow mb-3">
                <Star className="w-5 h-5 fill-light-yellow text" />{' '}
                <span className="font-semibold text-lg">Lecture 1 (HD Video)</span>
              </div>

              <h1 className="text-2xl lg:text-3xl font-bold mb-6">{course.title}</h1>

              <div className="flex items-center justify-between gap-4 my-2">
                <div className="bg-gradient-to-r from-light-purple to-dark-purple px-4 py-2 flex justify-between items-center">
                  <div className="flex gap-1.5 items-center">
                    <Image
                      src={course.instructor.picture}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full w-5 h-5"
                    />
                    <span className="font-semibold text-sm">Message সাদমান ভাই</span>
                  </div>
                </div>
                <button className="flex items-center gap-1.5">
                  <Image src={MessengerIcon} alt="Message" width={20} height={20} />
                  <span className="font-semibold text-sm">Private গ্রুপ</span>
                </button>
              </div>
              <div className="font-semibold">America থেকে একদম Free হেল্প করতে চাই!</div>
            </div>

            <button className="bg-[#4B0762] hover:bg-[#5C0873] transition-colors shadow-xl px-4 py-2 rounded-md">
              Next Lecture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
