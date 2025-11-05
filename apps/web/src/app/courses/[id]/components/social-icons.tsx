'use client';

import LikeIcon from '@/assets/like.png';
import LoveIcon from '@/assets/love.png';
import Image from 'next/image';
import { useState } from 'react';

export default function SocialIcons() {
  const [liked, setLiked] = useState(false);
  const [loved, setLoved] = useState(false);
  const likeHandler = () => {
    setLiked((prev) => {
      if (loved && !prev) setLoved(false);
      return !prev;
    });
  };

  const loveHandler = () => {
    setLoved((prev) => {
      if (liked && !prev) setLiked(false);
      return !prev;
    });
  };

  return (
    <div className="flex items-center justify-center gap-[clamp(0.25rem,1vw,1rem)]">
      <button
        onClick={likeHandler}
        className={`
          flex items-center gap-[clamp(0.15rem,1vw,0.5rem)]
          py-[clamp(0.25rem,0.5vw,0.75rem)]
          px-[clamp(0.5rem,1vw,1rem)]
          rounded-full transition-all
          text-[clamp(0.75rem,1vw,1rem)] 
          <pre className="  mid0:text-[12px] mid1:text-[13px] mid2:text-[14px] mid3:text-[17px] mid4:text-[17px] text-[#7D7B7B]
          ${liked ? 'bg-[#2196F3] bg-opacity-30 font-bold text-[#2196F3]' : ''}
        `}
      >
        <Image
          src={LikeIcon}
          alt="Like"
          className="w-[clamp(0.4rem,1.6vw,2rem)] h-[clamp(0.4rem,1.6vw,2rem)] 
          mid0:w-[13px] mid0:h-[13px] 
          mid1:w-[15px] mid1:h-[15px] 
          mid2:w-[16px] mid2:h-[16px] 
          mid3:w-[17px] mid3:h-[17px] 
          mid4:w-[17px] mid4:h-[17px]
          "
        />
        <span>Like</span>
      </button>
      <button
        onClick={loveHandler}
        className={`
          flex items-center gap-[clamp(0.25rem,1vw,0.5rem)]
          py-[clamp(0.25rem,0.5vw,0.75rem)]
          px-[clamp(0.5rem,1vw,1rem)]
          rounded-full transition-all
          text-[clamp(0.75rem,1vw,1rem)] text-[#7D7B7B]
          ${loved ? 'bg-[#FF4945] bg-opacity-30 font-bold text-[#FF4945]' : ''}
        `}
      >
        <Image
          src={LoveIcon}
          alt="Love"
          className="w-[clamp(0.4rem,1.6vw,2rem)] h-[clamp(0.4rem,1.6vw,2rem)]
          mid0:w-[13px] mid0:h-[13px] 
          mid1:w-[15px] mid1:h-[15px] 
          mid2:w-[16px] mid2:h-[16px] 
          mid3:w-[17px] mid3:h-[17px] 
          mid4:w-[17px] mid4:h-[17px]
          "
        />
        <span>Love</span>
      </button>
    </div>
  );
}
