'use client';

import LikeIcon from '@/assets/like.png';
import HeartIcon from '@/assets/circleHeart.png';
import MessengerIcon from '@/assets/messenger.png';
import Image from 'next/image';
import { Eye, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { ICourseDisplay } from '@elearning/types'; 
import { ObjectId } from 'mongoose';
import ReactionButtons from '@/app/(home)/components/ReactionButtons';
import { formatCompactNumber } from '@/lib/formatNumber';

type ReactionType = 'like' | 'love' | 'wow';

interface InitialReactionsShape {
  like?: number;
  love?: number;
  wow?: number;
  total?: number;
}


interface SocialIconsBarProps {
  display: ICourseDisplay;
  instructorImage?: string;
  userReaction?: { type: ReactionType | null } | null;
  initialReactions?: InitialReactionsShape;
  courseId: ObjectId | string;
}

export default function SocialIconsBar({ display, courseId, initialReactions, userReaction }: SocialIconsBarProps) {
 
  return (
    <>
      <div className="relative md:hidden">
        <ReactionButtons courseId={courseId as string} initialReactions={initialReactions} userReaction={userReaction}/>
      </div>

      <div className="flex items-center gap-[clamp(0.35rem,2vw,0.5rem)] text-gray-600 md:hidden">
        <div className="flex -space-x-[clamp(0.125rem,1vw,0.25rem)]">
          <Image
            src={HeartIcon}
            alt="Love"
            width={20}
            height={20}
            className="w-[20px] h-[20px] sm-custom:w-[19px] sm-custom:h-[19px] xs:w-[18px] xs:h-[18px] tiny:w-[12px] tiny:h-[12px] z-10"
          />
          <Image
            src={LikeIcon}
            alt="Like"
            width={20}
            height={20}
            className="w-[20px] h-[20px] sm-custom:w-[19px] sm-custom:h-[19px] xs:w-[18px] xs:h-[18px] tiny:w-[12px] tiny:h-[12px]"
          />
        </div>
        <span className="text-[16px] sm-custom:text-[16px] xs:text-[13px] tiny:text-[12px]">{formatCompactNumber(display?.likes)}</span>
      </div>

      <div className="flex items-center gap-[clamp(0.25rem,1.9vw,0.5rem)] text-gray-600 md:hidden">
        <Eye className="w-[20px] h-[20px] sm-custom:w-[20px] sm-custom:h-[20px] xs:w-[18px] xs:h-[18px] tiny:w-[15px] tiny:h-[15px]" />
        <span className="text-[15px] sm-custom:text-[15px] xs:text-[13px] tiny:text-[12px] whitespace-nowrap">
          {formatCompactNumber(display.views)} views
        </span>
      </div>

      <button className="flex items-center gap-[clamp(0.25rem,1.9vw,0.5rem)] text-gray-600 md:hidden">
        <Image
          src={MessengerIcon}
          alt="Message"
          width={21}
          height={21}
          className="w-[21px] h-[21px] sm-custom:w-[21px] sm-custom:h-[21px] xs:w-[18px] xs:h-[18px] tiny:w-[12px] tiny:h-[12px]"
        />
        <span className="text-[15px] sm-custom:text-[15px] xs:text-[13px] tiny:text-[13px] whitespace-nowrap">
          Private গ্রুপ
        </span>
      </button>
    </>
  );
}
