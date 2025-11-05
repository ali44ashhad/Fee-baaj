// components/HomeInstructor.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BadgeCheck } from 'lucide-react';

interface Instructor {
  picture?: string;
  name: string;
  profession: string;
  description: string;
  pictureId?: string;
  pictureUrl?: string;
}

interface HomeInstructorProps {
  instructor: Instructor;
}


const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || ""

// regex to find the first emoji (extended pictographic)
const emojiRegex = /\p{Extended_Pictographic}/u;

const HomeInstructor: React.FC<HomeInstructorProps> = ({ instructor }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!instructor || !instructor.description) return null;

  const raw = instructor.description;

  // find first emoji
  const match = raw.match(emojiRegex);
  const cutoffIndex = match
    ? raw.indexOf(match[0]) + match[0].length
    : 75;

  const isLongReview = raw.length > cutoffIndex;
  const displayText = isExpanded || !isLongReview
    ? raw
    : raw.substring(0, cutoffIndex);

  const toggleExpand = () => setIsExpanded(prev => !prev);


  const imageSource =  instructor?.pictureUrl ? instructor.pictureUrl : "/userPlaceHolder.jpg";
  return (
    <div className="px-4 pt-3 hidden md:block mb-3">
      <div className="flex mb-1 justify-start items-start gap-2">
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
            <Image
              src={imageSource!}
              alt={instructor.name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
            <h4 className="instructor-name font-medium text-sm leading-none m-0">
              {instructor.name}
            </h4>
            <BadgeCheck className="text-white fill-blue-400 w-5 h-5 shrink-0" />
          </div>
          <div className="max-w-fit bg-blue-500 px-2 rounded text-white text-sm font-semibold">
            {instructor.profession}
          </div>
        </div>
      </div>

      <div className="text-sm w-full leading-none whitespace-pre-line inline">
        <p className="text-sm flex" style={{ lineHeight: '1.2em' }}>
          {displayText}
          {isLongReview && !isExpanded && (
            <span
              onClick={toggleExpand}
              className="text-[#7D7B7B] cursor-pointer inline px-1"
            >
              ...See more
            </span>
          )}
        </p>
        {isLongReview && isExpanded && (
          <span
            onClick={toggleExpand}
            className="text-[#7D7B7B] cursor-pointer inline px-1"
          >
            See less
          </span>
        )}
      </div>
    </div>
  );
};

export default HomeInstructor;
