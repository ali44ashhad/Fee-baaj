'use client';

import { listReviews } from '@/app/reviews/actions';
import { StarRating } from '@/components/star-rating';
import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { ICourseResponse, IDataLoadedResponse, IReviewResponse } from '@elearning/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import ReviewBox from './review-box';
import { formatCompactNumber } from '@/lib/formatNumber';

interface ReviewsProps {
  course: ICourseResponse;
}

export default function Reviews({ course }: ReviewsProps) {
  const { display } = course;
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<IReviewResponse[]>([]);
  const { isLoading, data } = useQuery<IDataLoadedResponse<IReviewResponse>>({
    queryKey: ['reviews', page, course.id],
    queryFn: () => listReviews(course.id, page),
    enabled: !!course,
    retry: false,
  });

  const handleLoadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  useEffect(() => {
    if (data && data.data.length > 0) {
      setReviews((prev) => {
        // filter new items whose id is not already in prev
        const newOnes = data.data.filter((r) => !prev.some((existing) => existing.id === r.id));
        return [...prev, ...newOnes];
      });
    }
  }, [data]);

  return (
    <div className="my-10">
      <div className="bg-gradient-to-r from-light-purple to-dark-purple py-2 px-2 rounded shadow flex gap-2 items-center ">
        <div className="sm:hidden">
          <StarRating rating={formatCompactNumber(display.rating)} size="md" color="normal" />
         
        </div>

        {/* Visible only on md and larger screens */}
        <div className="hidden sm:block">
          <StarRating rating={Number(display.rating)} size="lg" color="normal" />
        </div> 
        <p className="responsive-review sm-custom:text-[18px] xs:text-[17px] tiny:text-[12px] text-[clamp(9px, 1.7vw, 24px)] truncate">
          {formatCompactNumber(display.rating)} Star Course Review ● {formatCompactNumber(display.reviews)} ratings
        </p>
      </div>
      <div className="mt-3">
        {isLoading && <Loading />}
        <div className="grid grid-cols-1 md:grid-cols-2 ">
          {!isLoading && data && reviews.map((review) => <ReviewBox key={review.id} review={review} />)}
        </div>

        {data && data.currentPage < data.total / data.perPage && (
          <div className="flex justify-center mt-6">
            <Button onClick={handleLoadMore} loading={isLoading} className="bg-gray-200 text-gray-800">
              {isLoading ? 'Loading...' : 'See More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
