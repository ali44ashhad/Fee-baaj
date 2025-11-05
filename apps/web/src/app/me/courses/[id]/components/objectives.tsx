'use client';

import Button from '@/components/ui/button';
import { useState } from 'react';

interface ObjectivesProps {
  objectives: string[];
}

export default function Objectives({ objectives }: ObjectivesProps) {
  const [visibleCount, setVisibleCount] = useState(5);

  const showMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  return (
    <div className="space-y-2">
      <h3 className="font-medium">What you'll learn:</h3>
      <ul className="list-disc pl-5 space-y-1">
        {objectives.slice(0, visibleCount).map((o, i) => (
          <li key={i}>
            {o}
          </li>
        ))}
      </ul>
      {visibleCount < objectives.length && (
        <Button onClick={showMore} className="bg-gray-200 text-gray-800">
          See more
        </Button>
      )}
    </div>
  );
}
