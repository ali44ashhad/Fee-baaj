'use client';

import { useState, useEffect } from 'react';
import { AuthPopup } from '../../app/auth/components/auth-popup';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import webRoutes from '@/lib/webRoutes';

import Logo from '@/app/logo.jpg';
import Image from 'next/image';
import { usePathname } from 'next/navigation';


const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || process.env.NEXT_PUBLIC_MEDIA_API_URL; // prefer explicit media url


export function Navigation() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);

 
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Safe pathname access
  // const safePathname = isMounted ? pathname : null;
  const isCoursePage = isMounted && /^\/courses\/[^\/]+$/.test(pathname || '');

  const existingAvatarUrl = user?.pictureUrl ||  "/userPlaceHolder.jpg" ;


  // Hydration-safe active class generator
  const getActiveClass = (targetPath: string) => {
    return isMounted && pathname === targetPath ? 'border-b-2 border-red-500' : '';
  };

  // Hydration-safe image source resolver
  const getImageSource = (targetPath: string, activeSrc: string, inactiveSrc: string) => {
    return isMounted && pathname === targetPath ? activeSrc : inactiveSrc;
  };

  const handleLogin = () => {
    setAuthMode('login');
  };

  const navItems = [
    {
      path: '/',
      iconRed: '/icons-home/home_red.svg',
      iconGray: '/icons-home/home_gray.svg',
      label: 'Courses & Posts',
    },
    {
      path: '/free-groups',
      iconRed: '/icons-home/groups_red.svg',
      iconGray: '/icons-home/groups_gray.svg',
      label: 'Free Groups',
    },
    {
      path: '/live-courses',
      iconRed: '/icons-home/youtube_red.svg',
      iconGray: '/icons-home/youtube_gray.svg',
      label: 'Live Courses',
    },
  ];

  return (
    <>
      {/* Mobile Navigation - only renders after hydration */}
      {isMounted && !isCoursePage && (
        <nav className="md:hidden overflow-hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center py-2 z-40">
          <Link href="/" className="flex flex-col items-center text-gray-600">
            <div className="text-primary mb-1">
              <img
                src={getImageSource('/', '/icons-home/home_red.svg', '/icons-home/home_gray.svg')}
                alt="home"
                className="
                w-[32px] h-[32px]
                xs:w-[30px] xs:h-[30px]
                tiny:w-[28px] tiny:h-[28px]
              "
              />
            </div>
            <span
              className={`
              sm-custom:text-[11px]
              xs:text-[10px]
              tiny:text-[9px]
              font-medium
              leading-tight
              text-center
              whitespace-nowrap
              ${getActiveClass('/') ? 'text-red-500' : 'text-gray-400'}
              `}
            >
              Courses & Posts
            </span>
          </Link>

          <Link href="/free-groups" className="flex flex-col items-center text-gray-600">
            <div className="mb-1">
              <img
                src={getImageSource('/free-groups', '/icons-home/groups_red.svg', '/icons-home/groups_gray.svg')}
                alt="groups"
                className="
                w-[34px] h-[34px]
                xs:w-[32px] xs:h-[32px]
                tiny:w-[30px] tiny:h-[30px]
              "
              />
            </div>
            <span
              className={`
              sm-custom:text-[11px]
              xs:text-[10px]
              tiny:text-[9px]
              font-medium
              leading-tight
              text-center
              whitespace-nowrap
              ${getActiveClass('/free-groups') ? 'text-red-500' : 'text-gray-400'}
            `}
            >
              Free Groups
            </span>
          </Link>

          <Link href="/live-courses" className="flex flex-col items-center text-gray-600">
            <div className="mb-1">
              <img
                src={getImageSource('/live-courses', '/icons-home/youtube_red.svg', '/icons-home/youtube_gray.svg')}
                alt="youtube"
                className="
                w-[32px] h-[27px]
                xs:w-[29px] xs:h-[24px]
                tiny:w-[28px] tiny:h-[23px]
              "
              />
            </div>
            <span
              className={`
              sm-custom:text-[11px]
              xs:text-[10px]
              tiny:text-[9px]
              font-medium
              leading-tight
              text-center
              whitespace-nowrap
              ${getActiveClass('/live-courses') ? 'text-red-500' : 'text-gray-400'}
            `}
            >
              Live Courses
            </span>
          </Link>

          {isAuthenticated && (
            <Link className="cursor-pointer flex flex-col items-center" href={webRoutes.profile}>
              <div className="rounded-full mb-1">
                <Image
                  className="
                  rounded-full
                  w-[31px] h-[31px]
                  xs:w-[30px] xs:h-[30px]
                  tiny:w-[25px] tiny:h-[25px]
                "
                  alt="user"
                  width={31}
                  height={31}
                  src={existingAvatarUrl || '/userPlaceHolder.jpg'}
                />
              </div>
            </Link>
          )}
        </nav>
      )}

      {/* Desktop Navigation */}
      <nav
        className="
          hidden md:flex items-center relative
          mx-5
          h-[90px]  bg-white z-50 
        "
      >
        {/* Logo (absolute left) */}
        <div className="absolute left-0 flex items-center h-full">
          <Link
            href="/"
            className="
              flex items-center font-bold text-primary
              text-[clamp(1.5rem,3vw,2rem)]
              mid0:text-[21px] mid1:text-[23px]
              mid2:text-[25px] mid3:text-[29px]
              mid4:text-[29px]
            "
          >
            <div
              className="
                mr-1 overflow-hidden rounded-full 
                w-[clamp(32px,5vw,50px)] h-[clamp(32px,5vw,50px)]
                mid0:w-[32px] mid0:h-[32px] 
                mid1:w-[36px] mid1:h-[36px] 
                mid2:w-[42px] mid2:h-[42px] 
                mid3:w-[50px] mid3:h-[50px] 
                mid4:w-[50px] mid4:h-[50px]
              "
            >
              <Image
                src={Logo}
                alt="Freebaj"
                width={100}
                height={100}
                className="w-full h-full object-cover "
                priority
              />
            </div>
            
              <span className="mb-[-0.9vw]">reebaj</span>
          
          </Link>
        </div>

        {/* Centered Nav Links */}
        <div
          className="
            mx-auto flex items-center justify-center
            w-[80%] min-w-0 h-full
            font-semibold space-x-[clamp(1rem,3vw,2rem)]
            overflow-hidden
          "
        >
          {navItems.map((item) => {
            const isActive = isMounted && pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className="
                  flex flex-col items-center justify-end relative h-full
                  px-[clamp(0.5rem,1vw,1rem)]
                  text-[clamp(0.75rem,1vw,0.875rem)]
                  flex-shrink-0
                "
              >
                <div className="h-[48px] flex items-center justify-center">
                  <img
                    src={isActive ? item.iconRed : item.iconGray}
                    alt={item.label}
                    className="
                      h-[28px] w-auto -mb-4
                      mid1:h-[32px] mid2:h-[34px]
                      mid3:h-[39px] mid4:h-[39px]
                    "
                  />
                </div>
                <span
                  className={`
                    text-[clamp(0.65rem,1vw,0.75rem)] pt-0 pb-1
                    mid1:text-[10px] mid2:text-[12px]
                    mid3:text-[14px] mid4:text-[14px]
                    ${isActive ? 'text-red-500' : 'text-gray-400'}
                  `}
                >
                  {item.label}
                </span>
                {isActive && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500" />}
              </Link>
            );
          })}
        </div>

        {/* Auth Buttons (absolute right) */}
        <div
          className="absolute right-0 flex items-center h-full gap-[clamp(0.5rem,1vw,1rem)]
          text-[clamp(10px,1.5vw,18px)] mid1:text-[17px]
          mid2:text-[19px] mid3:text-[20px] mid4:text-[20px]
        "
        >
          {isLoading ? (
            <div className="px-[clamp(0.5rem,1vw,1rem)]" />
          ) : isAuthenticated ? (
            <>
              <Link
                href={webRoutes.myCourses}
                className="
                  border border-primary text-primary
                  px-[clamp(0.5rem,1vw,1rem)] py-[clamp(0.25rem,0.8vw,0.4rem)]
                  rounded-md whitespace-nowrap
                "
              >
                My courses
              </Link>

              <Link className="cursor-pointer flex flex-col items-center" href={webRoutes.profile}>
                <div className="rounded-full mb-1">
                  <Image
                    className="rounded-full w-[40px] h-[40px]"
                    alt="user"
                    width={50}
                    height={50}
                    src={existingAvatarUrl || '/userPlaceHolder.jpg'}
                  />
                </div>
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={handleLogin}
                className="
                  bg-white text-primary border border-primary
                  hover:bg-primary hover:text-white transition-colors duration-200
                  px-[clamp(0.5rem,1vw,1rem)] py-[clamp(0.25rem,0.8vw,0.4rem)]
                  rounded-md whitespace-nowrap
                "
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className="
                  bg-primary text-white font-semibold
                  px-[clamp(0.5rem,1vw,1rem)] py-[clamp(0.25rem,0.8vw,0.4rem)]
                  rounded-md whitespace-nowrap
                "
              >
                Your Free Account
              </button>
            </>
          )}
        </div>
      </nav>

      <AuthPopup
        authMode={authMode!}
        setAuthMode={setAuthMode}
        isOpen={isDialogOpen!}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}

export default Navigation;
