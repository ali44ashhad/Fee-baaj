// app/loading.tsx
'use client';

import { useEffect } from 'react';
import NProgress from 'nprogress';
import Skeleton from 'react-loading-skeleton';
import 'nprogress/nprogress.css';
import 'react-loading-skeleton/dist/skeleton.css';

export default function Loading() {
  // Start NProgress on mount, finish it on unmount
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
    NProgress.start();
    return () => {
      NProgress.done();
    };
  }, []);

  // Skeleton layout mimicking CourseItem: header, video body, footer texts
  return (
    <main className="min-h-screen w-full  h-full bg-[url('/cover-homepage.webp')] bg-repeat bg-center">
      <div className="max-w-[600px] w-[600px] sm:w-full mx-auto lg:px-4 py-4 sm:py-0 space-y-6">
        {[1, 2, 3].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-md p-4 space-y-4"
          >
            {/* Header: instructor avatar + title row */}
            <div className="hidden md:flex items-center space-x-4">
              <Skeleton circle width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton width="60%" height={20} />
                <Skeleton width="30%" height={16} />
              </div>
            </div>

            {/* Video player placeholder */}
            <div className="w-full h-[200px] rounded-lg overflow-hidden">
              <Skeleton height="100%" />
            </div>

            {/* Footer: course description lines */}
            <div className="space-y-2">
              <Skeleton width="80%" height={16} />
              <Skeleton width="50%" height={16} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
