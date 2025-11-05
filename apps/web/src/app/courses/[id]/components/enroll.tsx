'use client';

import { AuthPopup } from '@/app/auth/components/auth-popup';
import Button from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { ICourseEnrollResponse, ICourseResponse, IErrorResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { enroll } from '../../actions';
import { useRouter } from 'next/navigation';
import webRoutes from '@/lib/webRoutes';
import { errorAlert } from '@/lib/utils';
import Link from 'next/link';

interface EnrollProps {
  course: ICourseResponse;
}

export default function Enroll({ course }: EnrollProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const router = useRouter();

  const { mutate, isPending } = useMutation<ICourseEnrollResponse, IErrorResponse, string>({
    mutationFn: enroll,
    onSuccess: (results) => {
      router.replace(webRoutes.myCourse(course.slug));
    },
  });

  const authHandler = () => {
    if (isAuthenticated) enrollHandler();
    else {
      setAuthMode('signup');
      setIsDialogOpen(true);
    }
  };

  const enrollHandler = () => {
    if (course.price === 0) {
      mutate(course.slug);
    } else {
      errorAlert('Payment is not available.');
    }
  };

  return (
    <>
      {course.enrolled && (
        <Link
          className="w-full inline-block text-center bg-red-600 text-white rounded-md py-3 font-medium hover:bg-red-700"
          href={webRoutes.myCourse(course.slug, course.currentLectureId)}
        >
          <div className="font-bold   mid0:text-[20px] mid1:text-[23px] mid2:text-[27px] mid3:text-[27px] mid4:text-[27px]   text-[24px] sm:text-[24px] ">
            Go To Courseটাকা
          </div>
        </Link>
      )}
      {!course.enrolled && (
        <Button
          className={`flex mx-auto ${course.price > 0 ? 'h-[80%]' : 'h-[90%]'} w-full flex-col btn-fluid items-center justify-center`}
          onClick={authHandler}
          loading={isPending}
        >
          <span className="font-bold whitespace-nowrap text-white  sm-custom:text-[26px] xs:text-[25px] tiny:text-[21px]  mid0:text-[19px] mid1:text-[22px] mid2:text-[24px] mid3:text-[27px] mid4:text-[27px]   text-[24px] sm:text-[24px]">
            {course.price > 0 ? 'Live Course করুন' : 'Free Course নিন'}
          </span>

          {course.price > 0 && (
            <span
              style={{ fontWeight: '400' }}
              className="block whitespace-nowrap text-white text-[12px] sm-custom:text-[14px] xs:text-[13px] tiny:text-[12px] md:text-[16px] font-normal md:hidden"
            >
              ৩০ দিন Money-Back Guarantee
            </span>
          )}
        </Button>
      )}

      <div className="text-left">
        <AuthPopup
          authMode={authMode}
          setAuthMode={setAuthMode}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      </div>
    </>
  );
}
