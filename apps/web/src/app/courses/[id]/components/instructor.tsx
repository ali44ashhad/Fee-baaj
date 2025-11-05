'use client';

import ReactionButtons from '@/app/(home)/components/ReactionButtons';
import { ICourseDisplay, IInstructorResponse } from '@elearning/types';
import { BadgeCheck } from 'lucide-react';
import { ObjectId } from 'mongoose';
import Image from 'next/image';
import { useState } from 'react';
import SocialIcons from './social-icons';
import SocialIconsDescription from './social-icons-description';


type ReactionType = 'like' | 'love' | 'wow';

interface InitialReactionsShape {
  like?: number;
  love?: number;
  wow?: number;
  total?: number;
}

interface InstructorProps {
  instructor: IInstructorResponse;  
  display: ICourseDisplay;
  userReaction?: { type: ReactionType | null } | null;
  initialReactions?: InitialReactionsShape;
  courseId: ObjectId | string;
}


export default function Instructor({ instructor, display, userReaction, initialReactions, courseId  }: InstructorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongReview = instructor.description.length > 76;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const instructorImg = instructor.pictureUrl;

  const imageSrouce = instructorImg ? instructorImg : "/userPlaceHolder.jpg";

  const displayText =
    isExpanded || !isLongReview ? instructor.description : `${instructor.description.substring(0, 76)}`;

  return (
    <>
      <div className="px-2 md:hidden mb-3 py-3">
        <div className="flex mb-2 justify-start items-center gap-2">
          <div className="flex items-center gap-1">
            <div
              className="
          rounded-full bg-gray-100 overflow-hidden
          w-[30px] h-[30px]
          tiny:w-[28px] tiny:h-[28px]
          sm-custom:w-[35px] sm-custom:h-[35px]
        "
            >
              <Image src={imageSrouce} alt="instructor" width={35} height={35} className="w-full h-full object-cover" />
            </div>

            <div
              className="
          flex items-center gap-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full
          text-[18px]
          tiny:text-[16px]
        "
            >
              <h4 className="instructor-name">{instructor.name}</h4>
              <BadgeCheck
                className="
               text-white fill-blue-400 shrink-0
                 tiny-custom:w-[18px] tiny-custom:h-[18px]
                 w-[20px] h-[20px]
                 sm-custom:w-[21px] sm-custom:h-[21px] "
              />
            </div>
          </div>

          <div className="tiny:text-[10px]  xs:text-[14px] text-[16px] whitespace-nowrap bg-blue-500 px-2 py-1 rounded text-white font-semibold">
            {instructor.profession}
          </div>
        </div>

        <div className="tiny:text-[12px]   xs:text-[15px] text-[17px] leading-none whitespace-pre-line inline">
          <p style={{ lineHeight: '1.2em' }}>
            {displayText}
            {isLongReview && (
              <button onClick={toggleExpand} className="text-[#7D7B7B] inline px-1" type="button">
                {isExpanded ? 'See less' : '...See more'}
              </button>
            )}
          </p>
        </div>
      </div>

      {/* desktop */}
      <div className="hidden  w-full    mx-auto md:block border rounded px-3 py-5 mb-8">
        <div className="flex w-full mx-auto justify-center gap-10 items-start">
          <div className=" flex flex-col items-center mx-auto justify-between w-[36%] mid0:w-[39%] mid1:w-[41%]   mid3:w-[39%] mid4:w-[42%]  ">
            {/* Top Content */}
            <div className="mb-3 flex flex-col px-2 items-center">
              <div className="flex items-center whitespace-nowrap justify-center gap-2 mb-2">
                <h4 className="m-0 mid0:text-[12px] mid1:text-[14px] mid2:text-[17px] mid3:text-[17px] mid4:text-[17px] whitespace-nowrap">
                  {instructor.name}
                </h4>
                <BadgeCheck className="text-white fill-blue-400 text-[clamp(8px,1vw,14px)]" />
              </div>

              <div className="mid0:w-[74px] mid0:h-[74px] mid1:w-[84px] mid1:h-[84px] mid2:w-[101px] mid2:h-[101px] 
                        mid3:w-[102px] mid3:h-[102px] mid4:w-[102px] mid4:h-[102px] rounded-full bg-gray-100 overflow-hidden">
                <Image
                  src={imageSrouce}
                  alt="instructor"
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  // style={{
                  //   width: 'clamp(30px,5vw,60px)',
                  //   height: 'auto',
                  // }}
                />
              </div>

              <div
                style={{ background: 'rgba(10, 136, 0, 1)', fontWeight: '700' }}
                className="whitespace-nowrap mx-auto mt-2 bg-green-700  px-1 rounded text-white text-sm"
              >
                <pre className=" px-2 py-1 mid0:text-[9px] font-bold mid1:text-[12px] mid2:text-[13px] mid3:text-[15px] mid4:text-[16px] ">
                  {instructor.profession}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-grow text-sm whitespace-pre-line">
            <p className=" mid0:text-[10px] mid1:text-[11px] mid2:text-[14px] mid3:text-[14px] mid4:text-[14px]">{instructor.description}</p>
          </div>
        </div>

        <div className="flex py-2 justify-start items-center w-full">
         
            <div className='w-[16.4vw] mid0:w-[35%]  mid1:w-[37%] max-w-[250px] text-center '>
            <ReactionButtons courseId={courseId as string } initialReactions={initialReactions} userReaction={userReaction}/>
            </div>
      
          <div className="">
            <SocialIconsDescription display={display} picUrl={instructor?.pictureUrl} insId={instructor._id} />
          </div>
        </div>
      </div>
    </>
  );
}


