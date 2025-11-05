import { useState } from 'react';
import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  label?: string;
}

export function StarRating({ rating, onRatingChange, label }: StarRatingProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 cursor-pointer ${
              star <= (hover || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          />
        ))}
      </div>
    </div>
  );
}
