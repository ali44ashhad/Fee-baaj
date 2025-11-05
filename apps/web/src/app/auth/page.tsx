'use client';

import { useAuth } from '@/hooks/use-auth';
import { IAuthLoginResponse } from '@elearning/types';
import Image from 'next/image';
import { useState } from 'react';
import LoginForm from './components/login-form';
import RegisterForm from './components/register-form';
import Logo from '@/app/logo.jpg';
import { useRouter } from 'next/navigation';
import webRoutes from '@/lib/webRoutes';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const { mutate } = useAuth();
  const router = useRouter();

  const successCallback = (data: IAuthLoginResponse) => {
    mutate();
    router.replace(webRoutes.home);
  };
  return (
    <div className="w-full h-full overflow-auto bg-gradient-to-b from-[#D9ECFF] to-[#FFF4E8] fixed top-0 z-50">
      <button
        onClick={() => {
          router.replace(webRoutes.home);
        }}
        className="absolute left-4 top-4 text-gray-400 hover:text-gray-600 "
      >
        ✕
      </button>
      <div className="flex justify-center pt-8 pb-4">
        <Image src={Logo} alt="Freebaj" height={50} width={50} className="rounded-full mb-2" />
      </div>

      {isLogin ? <LoginForm successCallback={successCallback} /> : <RegisterForm successCallback={successCallback} />}

      <div className="text-center mb-5">
        {isLogin ? (
          <button type="button" onClick={() => setIsLogin(false)} className="text-primary font-medium hover:underline">
            Create an account
          </button>
        ) : (
          <button type="button" onClick={() => setIsLogin(true)} className="text-primary font-medium hover:underline">
            Log In Now
          </button>
        )}
      </div>
    </div>
  );
}
