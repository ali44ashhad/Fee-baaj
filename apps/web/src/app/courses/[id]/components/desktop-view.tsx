import { ICourseResponse } from '@elearning/types';
import Chapters from './chapters';
import { Check, Eye } from 'lucide-react';
import Reviews from './reviews';
import Objectives from './objectives';
import CourseBox from './course-box';
import { StarRating } from '@/components/star-rating';
import Instructor from './instructor';
import Image from 'next/image';
import ChampionIcon from '@/assets/champion.png';
import GuaranteeIcon from '@/assets/guarantee.png';
import PremiumIcon from '@/assets/premium.png';
import InstructorCard from '@/components/instructor-drag';
import { formatCompactNumber } from '@/lib/formatNumber';
// import CourseCountdown from './course-countdown';
// import DesktopChat from '@/app/chat/instructor/[insId]/components/DesktopChat';



interface CourseDetailDesktopViewProps {
  course: ICourseResponse;
  playlistUrl: string | '';
}


export default function CourseDetailDesktopView({
  course,
  playlistUrl,
}: CourseDetailDesktopViewProps) {
  const { display, bunnyVideoId } = course; 

  const arr = [
    { Icon: GuaranteeIcon, lines: ['Life-Time', 'Access'] },
    { Icon: ChampionIcon, lines: ['Free', 'Certificate'] },
    { imgSrc: '/groups_blue.png', lines: ['Free', 'Private group'] },
    { imgSrc: '/usa_heart.png', lines: ['Support', 'From America'] },
  ];

  return (
    <>
      {/* Hero Section */}
      <div className="w-full relative bg-gradient-to-r mid0:h-[333px]  mid1:h-[345px] mid2:h-[354px] 
                      mid3:h-[360px] mid4:h-[360px]  from-[#1C1D1F] to-[#3C0138] text-white shadow-lg "
                 >
        {/* ── CENTERED WRAPPER ── */}
        <div className="mx-auto h-full relative  max-w-[1150px]  flex items-start justify-between p-4 gap-3">
          
          {/* ← LEFT COLUMN: Course Info */}
          <div className="p-4 flex-1 flex  flex-col md:flex-row gap-x-5">

            <div className="pr-0  pl-4 md:mr-8 flex-1">
              <div className="mr-auto h-full px-2 sm:px-4 md:px-6 py-1 max-w-screen-lg">
                <h1 className="text-[clamp(1.2rem,2.5vw,2rem)] mid1:text-[24px] mid2:text-[28px] mid3:text-[31px] mid4:text-[31px] font-bold mb-4">
                  {course.title}
                </h1>
                <p className="pb-3 mb-6 md:text-[11px] w-[65%] max-w-[720px] mid1:text-[11px] mid2:text-[14px] mid3:text-[16px] mid4:text-[16px] break-words ">
                  {course.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {course.bestSeller && (
                    <span className="bg-light-yellow text-black px-2 py-1 rounded text-sm mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px] font-medium">
                      Bestseller
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[clamp(1rem,1.5vw,1.125rem)] mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px] text-light-yellow">
                      {formatCompactNumber(display.rating)}
                    </span>
                    <StarRating rating={Number(display.rating)} />
                    <span className="text-[clamp(0.75rem,1vw,0.875rem)] mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px] text-light-yellow">
                      ({formatCompactNumber(display.reviews)} Reviews)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="bg-gradient-to-r text-[clamp(0.9rem,1vw,1rem)] mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px] from-light-purple to-dark-purple px-2 font-semibold">
                      {formatCompactNumber(display.students)} students
                    </span>
                  </div>
                  <div className="flex gap-1 items-center rounded-sm">
                    <Eye className="w-4 h-4 text-white" strokeWidth={3} />
                    <span className="text-white text-[clamp(0.85rem,1vw,1rem)] mid1:text-[11px] mid2:text-[14px] mid3:text-[15px] mid4:text-[15px]">
                      <strong>{formatCompactNumber(display.views)}</strong> views
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-3 md:text-[11px] mid1:text-[11px] mid2:text-[14px] mid3:text-[16px] mid4:text-[16px] font-semibold">
                  <span className="flex gap-1 whitespace-nowrap items-center">
                    <img width="20px" alt="exclamation" src="/exlamation.png" />
                    Course duration: 3 months & Life-Time access
                  </span>
                  <span className="flex gap-1 whitespace-nowrap items-center">
                    <Check className="size-4" strokeWidth={4} />
                    Free Full Course & Private group
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ← RIGHT COLUMN: CourseBox */}
        

          {/* ← FEATURES BANNER (absolute) */}
          <div className="hidden md:block absolute 
                mid0:left-[36%] mid1:left-[35%] left-[33%] mid0:bottom-[3%] mid1:bottom-[3%]
                mid2:bottom-[3.9%] mid3:bottom-[4%] mid4:bottom-[4%]
                bottom-0 transform -translate-x-1/2 translate-y-1/2 z-10 mid0:w-[62%] mid1:w-[63%] w-[69%] max-w-[906px]">
            <div className="overflow-hidden rounded-md shadow-xl bg-white text-gray-800">
              <div className="flex flex-nowrap">
                {/* Premium */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-light-purple to-dark-purple text-white p-3 mid1:text-[13px] mid2:text-[15px] mid3:text-[20px] mid4:text-[20px] text-[12px]">
                  <Image
                    src={PremiumIcon}
                    alt="Premium Course"
                    className="w-[clamp(14px,3.5vw,40px)] h-[clamp(14px,3.5vw,40px)] mid0:w-[40px] mid0:h-[31px] mid1:w-[45px] mid1:h-[36px] mid2:w-[49px] mid2:h-[44px] mid3:w-[59px] mid3:h-[50px] mid4:w-[59px] mid4:h-[50px]"
                  />
                  <p className="leading-tight font-bold">Premium</p>
                  <p className="leading-tight font-bold">Course</p>
                </div>
                {/* Other features */}
                {arr.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex-1  py-5 flex flex-col items-center justify-between text-center border-gray-300 mid1:text-[13px] mid2:text-[16px] mid3:text-[18px] mid4:text-[18px] text-[13px]"
                  >
                    <div
                      className={`w-full h-full px-[5px] py-[2px] flex flex-col items-center justify-center ${
                        idx === arr.length - 1 ? 'border-r-0' : 'border-r-[2px]'
                      }`}
                    >
                      {item.Icon ? (
                        <Image
                          src={item.Icon}
                          alt={item.lines.join(' ')}
                          className="w-[clamp(9px,2.5vw,40px)] h-[clamp(9px,2.5vw,40px)] mid1:w-[30px] mid1:h-[30px] mid2:w-[30px] mid2:h-[30px] mid3:w-[30px] mid3:h-[30px] mid4:w-[30px] mid4:h-[30px]"
                        />
                      ) : (
                        <img
                          src={item.imgSrc}
                          alt={item.lines.join(' ')}
                          className="w-[clamp(9px,2.5vw,40px)] h-[clamp(9px,2.5vw,40px)] mid1:w-[30px] mid1:h-[30px] mid2:w-[30px] mid2:h-[30px] mid3:w-[30px] mid3:h-[30px] mid4:w-[30px] mid4:h-[30px] mx-auto"
                        />
                      )}
                      {item.lines.map((text) => (
                        <span key={text} className="whitespace-nowrap font-semibold">
                          {text}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <CourseBox playlistUrl={course.videoStatus.playbackUrl} course={course} />
      </div>

      {/* Main Content */}
      <div className=" flex items-center px-4 pt-20"> 
        <div className="flex flex-col  mx-auto mid0:w-[570px] mid1:w-[630px] mid2:w-[751px] mid3:w-[785px] mid4:w-[793px]    md:flex-row gap-5">
          <div className="pr-0    md:pr-8 flex-1">
            {course.instructor && <Instructor courseId={course._id} initialReactions={course.reactions} userReaction={course.userReaction} instructor={course.instructor} display={display} />}
            <Chapters
              videoId={(bunnyVideoId as string) || ''}
              playlistUrl={playlistUrl}
              chapters={course.chapters}
            />
            <Reviews course={course} />
            <Objectives objectives={course.objectives} />
          </div>
        </div>
         <div className='w-[30%] mid0:w-[22%] mid1:w-[26%] mid2:w-[23%] mid3:w-[23%] mid4:w-[18%]  max-w-[500px]'>

         </div>
      </div>
      <InstructorCard
        instructorName={course?.instructor?.name}
        instructorProfession={course?.instructor.profession}
        profilePicUrl={course?.instructor?.pictureUrl}
        initialVisible={true}
        instructorId= {course?.instructor?._id as string}
      />
    </>
  );
}
