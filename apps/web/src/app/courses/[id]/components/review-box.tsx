'use client';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { IReviewResponse } from '@elearning/types';
import { StarRating } from '@/components/star-rating';
import { useState } from 'react';

interface ReviewBoxProps {
  review: IReviewResponse;
}

export default function ReviewBox({ review }: ReviewBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongReview = review.comment.length > 150;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  console.log(review)
  const url = process.env.NEXT_PUBLIC_API_URL;
  const id = review.user?.pictureId;
  const imageSrouce = id ? `${url}/images/${id}` : '/userPlaceHolder.jpg';

  const displayText = isExpanded || !isLongReview ? review.comment : `${review.comment.substring(0, 150)}...`;

  return (
    <div className="py-4 md:py-8 border-b border-gray-200 md:px-2 ">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-12 h-12 overflow-hidden rounded-full">
          <Image src={imageSrouce} alt={review.user.name} width={48} height={48} className="object-cover" />
        </div>

        <div>
          <h3 className="text-gray-800 font-semibold">{review.user.name}</h3>
          <div className="flex items-center gap-2">
            <div className="flex">
              <StarRating rating={review.rating} color="dark" size="sm" />
            </div>
            <span className="text-sm font-semibold text-gray-500">{review.timeAgo}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 w-full max-w-full">
        <p className="text-gray-600 leading-relaxed break-words">{displayText}</p>
        {isLongReview && (
          <button onClick={toggleExpand} className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2">
            {isExpanded ? 'Read less' : 'Read more'}
          </button>
        )}
      </div>
    </div>
  );
}
