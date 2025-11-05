'use server';

import serverRequest from '@/lib/server-request';
import { IDataLoadedResponse, IReviewResponse } from '@elearning/types';

export async function listReviews(courseId: string, page = 1): Promise<IDataLoadedResponse<IReviewResponse>> {
  const responseData = await serverRequest<IDataLoadedResponse<IReviewResponse>>(
    `/reviews?course_id=${courseId}&page=${page}`,
  );
  return responseData;
}
