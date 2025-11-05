'use client';

import { IChapterResponse, ICourseResponse } from '@elearning/types';

import { AlarmClock } from 'lucide-react';
// import Button from '@/components/ui/button';
import Enroll from './enroll';
import { useEffect, useState } from 'react';
import { InfinityIcon, LightBulbIcon, TrophyIcon, UsersGroupIcon, YoutubeIcon } from '@/lib/icons';
import { StarRating } from '@/components/star-rating';
import VideoPlayer from './VideoPlayer';
import CourseCountdown from './course-countdown';
import { useCountdown } from '@/hooks/use-countdown';
import { useSettings } from '@/lib/settings-context';
import { convertToBengaliDigits } from '@/lib/convertToBengaliDigits';

interface CourseBoxProps {
  course: ICourseResponse;
  playlistUrl: string | '';
}

// prefer explicit media url from env; fallback to empty string
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || '';

export default function CourseBox({ course, playlistUrl: initialPlaylistUrl }: CourseBoxProps) {
  const { display, originalPrice, premium, price } = course;
  const { settings } = useSettings();
  const { show } = useCountdown(settings?.discountValidUntil);

  const [isFixed, setIsFixed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const fixed = scrollPosition > 160;
      setIsFixed(fixed);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // const formatRoundedDuration = (seconds: number): string => {
  //   const hours = Math.floor(seconds / 3600);
  //   const minutes = Math.round((seconds % 3600) / 60);

  //   if (minutes >= 30) return `${hours + 1} hours`;
  //   if (hours > 0) return `${hours} hours`;
  //   return `${minutes} minutes`;
  // };

  return (
    <div
      id="cart-box"
      className={`shadow-lg mb-3 bg-none z-[2000] mid0:w-[210px] mid1:w-[242px] mid2:w-[298px] mid3:w-[347px] mid4:w-[347px] max-w-[350px] 
        ${isFixed ? 'fixed top-4 right-[7%] mid4:right-[12%] mid0:right-[3%]' : 'absolute top-9 mid0:right-[3%] mid4:right-[12%] right-[7%]'}`}
      // note: we removed h-full from the outer container — inner wrapper handles height
    >
      {/* Wrapper: column flex that defines the viewport-sized box on desktop */}
      <div className="flex flex-col md:h-[97vh] h-auto w-full bg-transparent  overflow-hidden">
        {/* Video area (keeps your responsive heights) */}
        <div
          className="max-h-[400px]
              mid0:h-[190px]
              mid1:h-[206px]
              mid2:h-[210px]
              mid3:h-[250px]
              mid4:h-[260px]
              flex-shrink-0
             "
        >
          <VideoPlayer
            shouldPlay={true}
            videoPopups={course.videoPopups}
            playlistUrl={course.videoStatus.playbackUrl}
            videoId={course.bunnyVideoId}
          />
        </div>

        {/* Main content area: will expand and scroll if needed */}
        <div className="flex-1  overflow-auto bg-white py-1 px-5">
          <div
            className=" md:text-[10px]
            lg:text-[13px]
            xl:text-[16px]
            2xl:text-[18px] flex items-center gap-[5px] mb-1"
          >
            <span className="bg-primary mid0:text-[14px] mid1:text-[15px] mid2:text-[18px] mid3:text-[19px] mid4:text-[19px] py-1 text-white rounded px-[7px] font-bold whitespace-nowrap flex-shrink-0">
              {price > 0 ? '99% Free' : '100% Free'}
            </span>

            <span className="mid0:text-[14px] mid1:text-[15px] mid2:text-[18px] mid3:text-[22px] mid4:text-[22px] line-through text-gray-500 whitespace-nowrap flex-shrink-0">
              টাকা {convertToBengaliDigits(originalPrice)}
            </span>

            {price > 0 && (
              <span className="text-gray-500 mid0:text-[14px] mid1:text-[15px] mid2:text-[18px] mid3:text-[22px] mid4:text-[22px] whitespace-nowrap flex-shrink-0">
                ({convertToBengaliDigits(price)})
              </span>
            )}
          </div>

          {show && (
            <div className="text-sm text-red-600 flex items-center gap-1 font-medium mid0:text-[10px] mid1:text-[11px] mid2:text-[14px] mid3:text-[14px] mid4:text-[14px]">
              <AlarmClock className="size-4 " />
              <span>
                Offer ends in:{' '}
                <span className="font-bold mid0:text-[10px] mid1:text-[11px] mid2:text-[14px] mid3:text-[14px] mid4:text-[14px]">
                  <CourseCountdown short />
                </span>
              </span>
            </div>
          )}
          <div className="text-center w-full mt-2">
            <Enroll course={course} />
          </div>

          <p
            className="w-full whitespace-nowrap md:text-[10px]
                  lg:text-[10px]
                  xl:text-[14px]
                  2xl:text-[16px]"
            style={{ whiteSpace: 'nowrap', color: '#3B3C4B', fontWeight: '400', textAlign: 'center' }}
          >
            {price > 0 ? '৩০ দিন Money-Back Guarantee' : ''}
          </p>

          <div className=" ">
            <h3 className="font-bold text-gray-800 mid0:text-[10px] mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px]  ">
              Free course includes:
            </h3>
            <ul className="space-y-1 pb-3 mid0:text-[9px] mid1:text-[10px] mid2:text-[13px] mid3:text-[14px] mid4:text-[14px] ">
              <li className="flex items-center gap-x-2 gap-y-3">
                <YoutubeIcon
                  className="fill-gray-600 
        md:w-[10px] md:h-[10px]
        lg:w-[14px] lg:h-[14px]
        xl:w-[18px] xl:h-[18px]
        2xl:w-[20px] 2xl:h-[20px]"
                />
                <span className="text-gray-800">HD on-demand videos</span>
              </li>
              <li className="flex items-center gap-x-2 gap-y-3">
                <InfinityIcon className="fill-gray-600 md:w-[10px] md:h-[10px] lg:w-[14px] lg:h-[14px] xl:w-[18px] xl:h-[18px] 2xl:w-[20px] 2xl:h-[20px]" />
                <span className="text-gray-800">Full lifetime access</span>
              </li>
              <li className="flex items-center gap-x-2 gap-y-3">
                <UsersGroupIcon
                  className="fill-gray-600 
        md:w-[10px] md:h-[10px]
        lg:w-[14px] lg:h-[14px]
        xl:w-[18px] xl:h-[18px]
        2xl:w-[20px] 2xl:h-[20px]"
                />
                <span className="text-gray-800">Free private group access</span>
              </li>
              <li className="flex items-center gap-x-2 gap-y-3">
                <LightBulbIcon
                  className="fill-gray-600 
        md:w-[10px] md:h-[10px]
        lg:w-[14px] lg:h-[14px]
        xl:w-[18px] xl:h-[18px]
        2xl:w-[20px] 2xl:h-[20px]"
                />
                <span className="text-gray-800">Give unlimited exams for free</span>
              </li>
              <li className="flex items-center gap-x-2 gap-y-3">
                <TrophyIcon
                  className="fill-gray-600 
        md:w-[10px] md:h-[10px]
        lg:w-[14px] lg:h-[14px]
        xl:w-[18px] xl:h-[18px]
        2xl:w-[20px] 2xl:h-[20px]"
                />
                <span className="text-gray-800">Free certificate</span>
              </li>
            </ul>
          </div>
        </div>

        {/* FOOTER: always visible at bottom of the box */}
        <div className="bg-gradient-to-r from-light-purple to-dark-purple py-3 px-2 flex-shrink-0">
          <div className="flex justify-between">
            <div className="p-1 bg-light-yellow flex gap-1 items-center rounded-sm">
              <img src="/gloab.svg" alt="global" width={17} height={17} />
              <span className=" mid0:text-[10px] text-black font-bold mid1:text-[11px] mid2:text-[12px] mid3:text-[15px] mid4:text-[15px]">
                <strong>{display.students}</strong> students
              </span>
            </div>

            <div className="flex gap-1 items-center rounded-sm">
              <img src="/eye.svg" alt="eye" width={17} height={17} />
              <span className=" font-bold text-white mid0:text-[10px] mid1:text-[11px] mid2:text-[12px] mid3:text-[15px] mid4:text-[15px]">
                <strong>{display.views}</strong> views
              </span>
            </div>
          </div>

          <div className="mt-1 w-full text-center">
            <div className="flex items-center gap-1 justify-center">
              <span className="font-semibold mb-0.5 text-sm md:text-base text-yellow">{display.rating}</span>
              <StarRating rating={Number(display.rating)} color="normal" />
              <span className=" text-white font-bold mid0:text-[10px] mid1:text-[11px] mid2:text-[12px] mid3:text-[15px] mid4:text-[15px]">
                (<strong>{display.reviews}</strong> reviews)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
