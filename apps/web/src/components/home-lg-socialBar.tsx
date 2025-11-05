'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye } from 'lucide-react';
import webRoutes from '@/lib/webRoutes';
import ReactionButtons from '../app/(home)/components/ReactionButtons';
import MessengerIcon from '@/assets/messenger.png';
import { ICourseDisplay } from '@elearning/types';
import HeartIcon from '@/assets/circleHeart.png';
import LikeIcon from '@/assets/like.png';

import { formatCompactNumber } from '@/lib/formatNumber';

type ReactionType = 'like' | 'love' | 'wow';

interface SocialIconsBarProps {
  display: ICourseDisplay;
  courseId: string;
  // matches the API shape: counts for each type + total
  reactions: {
    like?: number;
    love?: number;
    wow?: number;
    total?: number;
  };
  // the user's reaction (if any) — null if none / not authenticated
  userReaction?: ReactionType | null;
}

export default function HomeSocialIconsBar({
  display,
  courseId,
  reactions,
  userReaction,
}: SocialIconsBarProps) {
 
 
  return (
    <div className="hidden md:flex px-4 py-1 justify-between items-center relative">
      <ReactionButtons courseId={courseId} initialReactions={reactions} userReaction={userReaction} />
      <div className="flex items-center gap-1 text-gray-600">
        <div className="flex -space-x-1">
          <Image src={HeartIcon} alt="Love" width={15} height={15} className="z-10" />
          <Image src={LikeIcon} alt="Like" width={15} height={15} />
        </div>
        <span className="text-sm">{formatCompactNumber(display?.likes)}</span>
      </div>
      {/* Views */}
      <div className="flex items-center gap-1 text-gray-600">
        <Eye className="w-4 h-4" />
        <span className="text-sm">{formatCompactNumber(display.views)} views</span>
      </div>

      {/* Course link */}
      <Link href={webRoutes.courseDetails(courseId)} className="flex items-center gap-1 text-gray-600">
        <Image src="/youtube.svg" alt="Course" width={20} height={20} />
        <span className="text-sm">Course দেখুন</span>
      </Link>

      {/* Private group */}
      <button className="flex items-center gap-1 text-gray-600">
        <Image src={MessengerIcon} alt="Message" width={15} height={15} />
        <span className="text-sm">Private গ্রুপ</span>
      </button>
    </div>
  );
}
