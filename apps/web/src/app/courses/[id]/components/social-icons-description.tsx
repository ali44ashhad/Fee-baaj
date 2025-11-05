'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { ObjectId } from 'mongoose';

import LikeIcon from '@/assets/like.png';
import HeartIcon from '@/assets/circleHeart.png';
import MessengerIcon from '@/assets/messenger.png';
import { ICourseDisplay } from '@elearning/types';
import { useAuth } from '@/hooks/use-auth';
import { AuthPopup } from '@/app/auth/components/auth-popup';
import { formatCompactNumber } from '@/lib/formatNumber';

interface SocialIconsDescriptionProps {
  display: ICourseDisplay;
  picUrl?: string;
  insId: string | ObjectId;
}



export default function SocialIconsDescription({ display, picUrl, insId }: SocialIconsDescriptionProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // State for AuthPopup
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);

  const imageSource = picUrl ? picUrl : '/userPlaceHolder.jpg';

  const handleMessageClick = useCallback(() => {
    const id = typeof insId === 'string' ? insId : insId.toString(); // Convert ObjectId if needed

    if (isAuthenticated) {
      router.push(`/chat/instructor/${id}`);
    } else {
      setAuthMode('login');
      setIsDialogOpen(true);
    }
  }, [isAuthenticated, insId, router]);

  return (
    <>
      <div
        className="
          flex flex-nowrap whitespace-nowrap items-center justify-between
          gap-[clamp(1rem,1.7vw,2.1rem)]
          text-[clamp(7px,1.25vw,19px)] 
          mid0:text-[10px] mid1:text-[12px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px]
           text-gray-600 w-full
        "
      >
        {/* Likes */}
        <div className="flex flex-nowrap items-center gap-[4px]">
          <div className="flex -space-x-[2px]">
            <Image
              src={HeartIcon}
              alt="Love"
              className="w-[clamp(0.6rem,1.7vw,2rem)] h-[clamp(0.6rem,1.7vw,2rem)] 
              mid0:w-[12px] mid0:h-[12px] 
              mid1:w-[14px] mid1:h-[14px] 
              mid2:w-[16px] mid2:h-[16px] 
              mid3:w-[17px] mid3:h-[17px] 
              mid4:w-[17px] mid4:h-[17px]
              "
            />
            <Image
              src={LikeIcon}
              alt="Like"
              className="w-[clamp(0.6rem,1.7vw,2rem)] h-[clamp(0.6rem,1.7vw,2rem)]
              mid0:w-[12px] mid0:h-[12px] 
              mid1:w-[14px] mid1:h-[14px] 
              mid2:w-[16px] mid2:h-[16px] 
              mid3:w-[17px] mid3:h-[17px] 
              mid4:w-[17px] mid4:h-[17px]"
            />
          </div>
          <span className="ml-[1vw]">{formatCompactNumber(display.likes)}</span>
        </div>

        {/* Views */}
        <div className="flex flex-nowrap items-center gap-[2px]">
          <Eye className="w-[clamp(0.6rem,1.7vw,2rem)] h-[clamp(0.6rem,1.7vw,2rem)]" />
          <span>{formatCompactNumber(display.views)} views</span>
        </div>

        {/* Private Group */}
        <button className="flex flex-nowrap items-center gap-[2px]">
          <Image
            src={MessengerIcon}
            alt="Message"
            className="w-[clamp(0.6rem,1.7vw,2rem)] h-[clamp(0.6rem,1.7vw,2rem)]
            mid0:w-[12px] mid0:h-[12px] 
              mid1:w-[14px] mid1:h-[14px] 
              mid2:w-[16px] mid2:h-[16px] 
              mid3:w-[17px] mid3:h-[17px] 
              mid4:w-[17px] mid4:h-[17px]
            "
          />
          <span>Private গ্রুপ</span>
        </button>

        {/* Message Instructor */}
        <button onClick={handleMessageClick} className="flex flex-nowrap items-center gap-[2px] focus:outline-none">
          <div
            className="w-[clamp(0.6rem,1.7vw,2rem)] h-[clamp(0.6rem,1.7vw,2rem)] 
          mid0:w-[12px] mid0:h-[12px] 
          mid1:w-[14px] mid1:h-[14px] 
          mid2:w-[16px] mid2:h-[16px] 
          mid3:w-[17px] mid3:h-[17px] 
          mid4:w-[17px] mid4:h-[17px]
            rounded-full bg-gray-100 overflow-hidden"
          >
            <Image width={120} height={120} src={imageSource} alt="Instructor" className="w-full h-full object-cover" />
          </div>
          <span>Message</span>
        </button>
      </div>

      {/* AuthPopup for login/signup if the user is not authenticated */}
      <AuthPopup
        authMode={authMode}
        setAuthMode={setAuthMode}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
