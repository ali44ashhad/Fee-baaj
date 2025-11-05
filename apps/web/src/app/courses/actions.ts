'use server';

import serverRequest from '@/lib/server-request';
import { ICourseEnrollResponse, IEnrollmentUnlockResponse } from '@elearning/types';

export async function enroll(courseId: string): Promise<ICourseEnrollResponse> {
  const responseData = await serverRequest<ICourseEnrollResponse>(`/courses/${courseId}/enroll`, 'POST');
  return responseData;
}

export async function unlock(enrollmentId: string): Promise<IEnrollmentUnlockResponse> {
  const responseData = await serverRequest<IEnrollmentUnlockResponse>(`/enrollments/${enrollmentId}/unlock`, 'POST');
  return responseData;
}
