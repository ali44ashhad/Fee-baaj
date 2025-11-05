'use client';

import Button from '@/components/ui/button';
import { Check } from 'lucide-react';
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
    <div className="my-10">
      <div className="bg-gradient-to-r from-light-purple to-dark-purple py-2 px-2 rounded shadow flex gap-2 items-center">
        <p className="text-center  sm-custom:text-[18px] xs:text-[17px] tiny:text-[14px] text-[clamp(9px, 1.7vw, 24px)]  font-bold md:font-semibold text-white">What you will learn?</p>
      </div>
      <div className="shadow border px-4 py-2 mt-3">
        {objectives.slice(0, visibleCount).map((o, i) => (
          <div key={i} className="py-2 flex items-center">
            <Check className="size-4 mr-2 text-gray-500 font-bold" />
            {o}
          </div>
        ))}
        {visibleCount < objectives.length && (
          <Button onClick={showMore} className="bg-gray-200 text-gray-800">
            See more
          </Button>
        )}
      </div>
    </div>
  );
}
