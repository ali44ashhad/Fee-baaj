// CourseHeader.tsx
import Image from 'next/image';
import { StarRating } from './star-rating';
import { convertToBengaliDigits } from '@/lib/convertToBengaliDigits';
import { formatCompactNumber } from '@/lib/formatNumber';

interface Display {
  rating: string | undefined;
  reviews: string | undefined;
  students: string | undefined;
}

interface CourseHeaderProps {
  title: string;
  display: Display;
  instructorImage?: string; // Optional, fallback if not provided
  price: number | undefined;
  originalP: string | undefined;
  premium: boolean | undefined;
  views: string | undefined;
}

const CourseHeader: React.FC<CourseHeaderProps> = ({ title, display, views, price, originalP }) => {
  return (
    <div className="bg-gradient-to-r px-0 md:px-3 py-2 from-[#1C1D1F] to-[#3C0138]  text-white ">
      <div className="">
        <h1 className="text-sm tiny:text-[19px] xs:text-[21px] sm-custom:text-[22px] lg:text-xl xl:text-2xl font-bold px-4 pt-2">
          {title}
        </h1>
        <div className="flex mt-2 px-4 items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-xs tiny:text-[15px] xs:text-[15px] sm-custom:text-[16px] md:text-base text-light-yellow">
              {formatCompactNumber(display.rating)}
            </span>
            <StarRating rating={Number(display.rating)} color="light" />
            <span className="text-xs tiny:text-[15px] xs:text-[15px] sm-custom:text-[15px] whitespace-nowrap md:text-base text-light-yellow font-semibold">
              ({formatCompactNumber(display.reviews)} Reviews)
            </span>
          </div>

          <div className="hidden md:flex gap-1 items-center">
            <Image width={20} height={20} src="/GraduationCap.svg" alt="graduation" />
            <span className="font-semibold whitespace-nowrap  text-sm md:text-base lg:text-lg">
              {formatCompactNumber(display.students)} student কোর্সে
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r gap-2 from-light-purple to-dark-purple text-white flex flex-nowrap justify-between items-center px-[clamp(0.75rem,4vw,1rem)] py-[clamp(0.25rem,2vw,0.75rem)] md:hidden my-2 w-full mx-0">
          <div className="flex flex-nowrap items-center gap-[clamp(0.25rem,1vw,0.75rem)]">
            <Image
              src="/GraduationCap.svg"
              alt="graduation"
              width={24}
              height={24}
              className="w-[22px] h-[22px] xs:w-[21px] xs:h-[21px] tiny:w-[18px] tiny:h-[20px]"
            />
            <span className="font-semibold whitespace-nowrap sm-custom:text-[16px] xs:text-[14px] tiny:text-[13px]">
              {formatCompactNumber(display.students)} student কোর্সে
            </span>
          </div>
          <div className="flex flex-nowrap items-center gap-[clamp(0.25rem,1vw,0.5rem)]">
            <Image
              src="/eye.svg"
              alt="views"
              width={26}
              height={26}
              className="w-[22px] h-[22px] xs:w-[21px] xs:h-[21px] tiny:w-[18px] tiny:h-[20px]"
            />
            <span className="font-semibold whitespace-nowrap ml-[clamp(0.1rem,2vw,0.5rem)] sm-custom:text-[16px] xs:text-[14px] tiny:text-[13px]">
              {formatCompactNumber(views)} views
            </span>
          </div>
        </div>

        <div className="flex flex-wrap px-4 py-1 gap-2 items-center">
          <span
            className="py-1 px-2 sm:px-3 md:px-4 rounded-sm font-bold tiny:text-[clamp(0.9rem,3.5vw,1.125rem)]  xs:text-[20px] sm-custom:text-[22px]   md:text-base lg:text-lg"
            style={{ backgroundColor: 'rgba(255, 0, 0, 1)' }}
          >
            {price && +price > 0 ? '99% Free কোর্স' : '100% Free কোর্স'}
          </span>

          {price > 0 && (
            <span className="text-white font-semibold text-xs tiny:text-[clamp(0.9rem,3.5vw,1.125rem)] xs:text-[20px] sm-custom:text-[22px] md:text-base lg:text-lg">
              টাকা {convertToBengaliDigits(price)}
            </span>
          )}

          <span className="text-white  line-through font-semibold tiny:text-[clamp(0.9rem,3.5vw,1.125rem)] xs:text-[20px] sm-custom:text-[22px]  md:text-sm lg:text-base">
            টাকা {convertToBengaliDigits(originalP)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CourseHeader;
