'use client';

import { useState, useEffect } from 'react';
import { AuthPopup } from '../../app/auth/components/auth-popup';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import Logo from '@/app/logo.jpg';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function MobileHeader() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768); // Tailwind `md` = 768px
    };

    checkScreenSize(); // initial check
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const isCoursePage = isMounted && /^\/courses\/[^\/]+$/.test(pathname || '');

  if (!isMounted || isCoursePage || !isSmallScreen) return null;

  return (
    <>
      <nav className=" bg-white border-t flex justify-between items-center p-3 z-40">
        <Link href="/" className="flex items-center  font-bold text-primary">
          <Image
            src={Logo}
            alt="Freebaj"
            width={50}
            height={50}
            priority
            className="rounded-full mr-1 w-[36px] h-[37px] xs:w-[31px] xs:h-[32px]  tiny:w-[29px] tiny:h-[30px] "
          />
          <span className="tiny:text-[20px] xs:text-[27px] sm-custom:text-[29px]">reebaj</span>
        </Link>

        {!isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => {
                setAuthMode('signup');
                setIsDialogOpen(true);
              }}
              className="text-white bg-primary font-bold px-2 py-1 rounded-md text-[clamp(15px,4vw,22px)]"
            >
              Free Account খুলুন
            </button>
          </div>
        ) : null}
      </nav>

      <AuthPopup
        authMode={authMode}
        setAuthMode={setAuthMode}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}

export default MobileHeader;
