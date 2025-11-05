'use client';

import { unlock } from '@/app/courses/actions';
import Button from '@/components/ui/button';
import webRoutes from '@/lib/webRoutes';
import { IEnrollmentUnlockResponse, IErrorResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface UnlockEnrollmentProps {
  courseId: string;
  enrollmentId: string;
  lectureId: string;
}

export default function UnlockEnrollment({ courseId, enrollmentId, lectureId }: UnlockEnrollmentProps) {
  const router = useRouter();
  const { mutate, isPending } = useMutation<IEnrollmentUnlockResponse, IErrorResponse, string>({
    mutationFn: unlock,
    onSuccess: (_) => {
      router.replace(webRoutes.myCourse(courseId, lectureId));
    },
  });

  return (
    <Button onClick={() => mutate(enrollmentId)} loading={isPending} className='text-lg'>
      Unlock the course
    </Button>
  );
}
