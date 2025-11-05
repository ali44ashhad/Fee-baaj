'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import animationData from '../../../../public/heart-face-animated-icon_12340036-2.json';

type LoveIconProps = {
  size?: number | string; // px number (e.g. 28) or css string (e.g. '1.5rem' / '24px')
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
};

export default function LoveIcon({ size = 28, loop = true, autoplay = true, className = '' }: LoveIconProps) {
  // normalize size to valid CSS values
  const width = typeof size === 'number' ? `${size}px` : size;
  const height = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        width,
        height,
        display: 'inline-block',
        overflow: 'hidden',
        lineHeight: 0,
        pointerEvents: 'none',
      }}
    >
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        // Important: pass style so internal svg/canvas gets the size
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
        }}
        // Optionally pass renderer settings to ensure aspect ratio
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' } as any}
      />
    </div>
  );
}
