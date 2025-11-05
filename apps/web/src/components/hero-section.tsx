'use client';

import { useSettings } from '@/lib/settings-context';
import { CheckCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import Button from './ui/button';

export function HeroSection() {
  const { settings } = useSettings();
  return (
    <div className="relative bg-emerald-200 md:h-[400px] h-[220px] overflow-hidden">
      <img
        src="https://s3-alpha-sig.figma.com/img/c1cb/4548/6d93a14c48eb18a7a7fd3c711c6d7d09?Expires=1741564800&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=QeX2G0lHIT~oqH-fwNydAUpg-Q-YFavkm7EM37fU4IFVT1dyUmaWtRKM~VyimPTEzmq1xA-EfWj0WqYkaNIT2APAtfY4NEDv9Aw~CMMZx7mnWnwVkW2mnoJWuDndwrxFfI8nXi1S3NyhJIP0IFt17gkc2P8kvJUMm7fbLid9caG0Dl3TEu~2ZB3J047e6PkluqU14tfLkaJrCMENzf2g9RsVorwiOgXVr93wwBbiaS4Myvvcil-rgMBKBGEYUkyt4BqVXtiWiMe73YRwwu4gMBxxJfOflzD7xO3r8eSjJSRMjjP48rUtejBKt1rcIu9fNHbjxmLu5liDv-dl09scPA__"
        alt=""
        className="absolute top-0 left-0 w-full h-full z-0"
      />
      <div className="absolute left-0 top-[50%] translate-y-[-50%] p-4 md:p-8 z-10 max-w-lg">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl md:text-3xl font-bold mb-4">
            <span className="md:hidden block">১০ কোটির বেশি students এর সাথে Free কোর্সে জয়েন করুন!</span>

            <span className="hidden md:block">Free courses - join কতজন ১০ কোটির বেশি student এর সাথে!</span>
          </h1>
          <div className="flex items-center gap-2 mb-4 text-sm md:text-base">
            <CheckCircle className="w-5 h-5 text-green-400" strokeWidth={3} />
            <span>Free Live support, group & certificate</span>
          </div>
          <Button className="bg-primary text-2xl py-2">
            <span className="md:hidden">100% Free Courses</span>
            <span className="hidden md:inline">
              <span className="font-bold">Free</span> only today:{' '}
              <span className="font-mono font-semibold">12h 59m 12s</span>
            </span>
          </Button>
        </div>
      </div>

      {/*   <Link href={settings?.banner.link || '#'} className="absolute right-0 h-full object-cover object-right">
        <Image
          src={settings?.banner.image || ''}
          alt="Banner"
          placeholder="blur"
          blurDataURL="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Sv5dzhCd3DeWPAupA1meEEf2nK9Dhz.png"
          fill
          className="object-contain"
          sizes="100vw"
        />
      </Link> */}
    </div>
  );
}
