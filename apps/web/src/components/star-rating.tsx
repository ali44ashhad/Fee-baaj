import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'normal' | 'light' | 'dark';
}

export function StarRating({ rating, maxRating = 5, size = 'md', color = 'light' }: StarRatingProps) {
  const getTextColor = () => {
    if (color === 'dark') return 'text-dark-yellow';
    if (color === 'light') return 'text-light-yellow';
    if (color === 'normal') return 'text-yellow';
  };

  const getFillColor = () => {
    if (color === 'dark') return 'fill-dark-yellow';
    if (color === 'light') return 'fill-light-yellow';
    if (color === 'normal') return 'fill-yellow';
  };

  const getSize = () => {
    if (size === 'lg') return 'w-4 h-4 md:w-6 md:h-6';
    if (size === 'md') return 'w-3.5 h-3.5';
    if (size === 'sm') return 'w-3 h-3';
  };

  return (
    <>
      <div
        className={`flex items-center ${size === 'lg' ? 'gap-1' : 'gap-0.5'}`}
        aria-label={`Rating: ${rating} out of ${maxRating} stars`}
      >
        {[...Array(maxRating)].map((_, index) => {
          const starValue = index + 1;
          return (
            <Star
              key={index}
              className={`${getSize()} ${
                starValue <= rating
                  ? `${getTextColor()} ${getFillColor()}`
                  : starValue <= rating + 0.5
                    ? `${getTextColor()} ${getFillColor()} [clip-path:inset(0_50%_0_0)]`
                    : 'text-gray-300'
              }`}
              aria-hidden="true"
            />
          );
        })}
        <span className="sr-only">
          {rating} out of {maxRating}
        </span>
      </div>
    </>
  );
}
