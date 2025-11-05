'use client';

import { useSettings } from '@/lib/settings-context';
import { useCountdown } from '@/hooks/use-countdown';
import MobileHeader from './navigation/mobile-header';
import { usePathname } from 'next/navigation';

export function CountdownBanner() {
  const { settings } = useSettings();
  const { show, displayText, shortDisplayText } = useCountdown(settings?.discountValidUntil);
  const pathname = usePathname();
  const isChatPage = pathname?.includes('/chat');

  if(isChatPage) return null 

  if (!show) return null; 
  
  return (
    <>
      {show &&  (
        <div className=" fixed top-0 left-0 w-full z-[100] ">
       
          <div className='bg-[#EEFF00] p-3'>
            <div className="max-w-7xl mx-auto">
              <div className="text-center text-lg    mid1:text-[15px] 
                        mid2:text-[20px] mid3:text-[20px] mid4:text-[20px] hidden md:block">
                <div className="text-center font-medium text-yellow-800">Free All Courses - 100% Free Today Only</div>
                <div className="">
                  <span className="font-normal mr-1">
                    <span className="font-semibold">Free Offer</span> ends in:
                  </span>
                  <span className="font-bold">{displayText}</span>
                </div>
              </div>

              <div className="md:hidden text-center flex justify-center tiny:text-[14px] xs:text-[17px] sm-custom:text-[20px] gap-0.2">
                <div className="font-bold  text-yellow-800">Free All Courses <span className='font-normal'> ends in:</span> </div>{'  '}
                
                <span className="font-bold ml-1"> {shortDisplayText}</span>
              </div>
            </div>
          </div>
          <MobileHeader />
        </div>
      )}
    </>
  );
}
