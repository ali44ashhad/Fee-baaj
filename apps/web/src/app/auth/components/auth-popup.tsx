'use client';

import { useRef, useEffect } from 'react';
import LoginForm from './login-form';
import RegisterForm from './register-form';
import { IAuthLoginResponse } from '@elearning/types';
import { useAuth } from '@/hooks/use-auth';
import Logo from '@/app/logo.jpg';
import Image from 'next/image';

type AuthMode = 'login' | 'signup' | null;

interface AuthPopupProps {
  isOpen: boolean;
  onClose: () => void;
  callback?: () => void;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
}

export function AuthPopup({ callback, authMode, setAuthMode }: AuthPopupProps) {
  const { mutate } = useAuth();

  // keep track of which videos we paused
  const pausedVideos = useRef<HTMLVideoElement[]>([]);

  useEffect(() => {
    if (authMode) {
      // Modal just opened → find all playing videos and pause them
      const vids = Array.from(document.querySelectorAll('video'));
      pausedVideos.current = vids.filter((v) => !v.paused);
      pausedVideos.current.forEach((v) => v.pause());
    } else {
      // Modal just closed → resume only those we paused
      pausedVideos.current.forEach((v) => {
        // make sure it's still in the DOM
        if (document.contains(v)) v.play().catch(() => {/* ignore autoplay errors */});
      });
      pausedVideos.current = [];
    }
  }, [authMode]);

  if (!authMode) return null;

  const successCallback = (data: IAuthLoginResponse) => {
    mutate();                // refresh auth state
    setAuthMode(null);       // close the modal
    if (callback) callback();
  };

  return (
    <div className="fixed overflow-auto inset-0 z-[9999] flex items-center justify-center p-0 md:p-4">
      <div className="w-full  relative max-w-full md:max-w-xl py-6 h-full md:rounded-xl md:max-h-[calc(99vh-4rem)]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D9ECFF] to-[#FFF4E8] opacity-[96%] pointer-events-none md:rounded-xl"></div>
        <div className="relative z-10 bg-transparent">
          <button
            onClick={() => setAuthMode(null)}
            className="absolute font-semibold left-4 top-[-10] text-gray-400 hover:text-gray-600"
          >
            <span className="hidden md:inline">✕</span>
            <img className="inline md:hidden" height={31} width={31} src="/greyLeftArr.svg" alt="leftarr" />
          </button>
          <div className="flex  justify-center">
            <Image src={Logo} alt="Freebaj" className="rounded-full w-[55px] h-[55px]" />
          </div>
          <div className="px-4 h-full sm:px-0 md:px-[10%]">
            {authMode === 'login' && <LoginForm successCallback={successCallback} />}
            {authMode === 'signup' && (
              <RegisterForm setAuthMode={setAuthMode} successCallback={successCallback} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
