// app/courses/[id]/loading.tsx
'use client';

import { useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import useMediaQuery from '@/hooks/useMediaQuery'; // or your own matchMedia hook
import { Circle } from 'lucide-react';

export default function LoadingCourseDetail() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
    NProgress.start();
    return () => {
      NProgress.done();
    };
  }, []);

  return isDesktop ? (
    <>
      <div className="flex items-start justify-between w-full p-5">
        <div className="w-[60%] p-5 text-left">
          <div className="w-full ">
            <Skeleton width="70%" />
            <Skeleton width="60%" />
            <Skeleton width="50%" />
            <Skeleton width="30%" />
          </div>
        </div>
        <div className="w-[20%] absolute top-9 mid0:right-[3%] mid4:right-[12%] right-[7%]">
          <div className="w-full h-[300px] rounded-lg overflow-hidden">
            <Skeleton height="100%" />
          </div>

          <div className="flex-1 space-y-2">
            <Skeleton height={20} />
            <Skeleton height={16} />
          </div>
          <Skeleton count={4} />
        </div>
      </div>

      <div className="flex items-start justify-between w-full p-5">
        <div className="w-[60%] p-5 text-left">
          <Skeleton width="70%" />
          <Skeleton width="60%" />
          <Skeleton width="50%" />
          <Skeleton width="80%" />
          <Skeleton width="30%" />
          <Skeleton width="90%" />
        </div>
        <div className="w-[30%]"></div>
      </div>
    </>
  ) : (
    <div className="h-full p-4">
      <div className="flex items-center space-x-4">
        <Skeleton circle width={50} height={50} />
        <div className="flex flex-row gap-2 items-center space-y-2">
          <Skeleton width={120} height={20} />
          <Skeleton width={100} height={20} />
        </div>
      </div>
      <div className="w-full mt-3 h-[300px] rounded-lg overflow-hidden">
        <Skeleton height="100%" />
      </div>
      <Skeleton count={3} />
    </div>
  );
}
