// app/hooks/use-auth.tsx
'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { IUserResponse } from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import { checkAuth, logoutUser } from '@/app/auth/actions';
import { useRouter } from 'next/navigation';

interface IAuthContext {
  user: IUserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  mutate: () => void;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<IUserResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const router = useRouter();

  // Clears auth state without redirecting
  const clearAuth = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // User‐initiated logout: clears state and then redirects home
  const logout = useCallback(async () => {
    try {
      await logoutUser();
      clearAuth();
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [clearAuth, router]);

  const { mutate, isPending } = useMutation<IUserResponse>({
    mutationFn: checkAuth,
    onSuccess: (data) => {
      if (data) {
        setUser(data);
        setIsAuthenticated(true);
      } else {
        clearAuth();           // no redirect here
      }
      setInitialCheckDone(true);
    },
    onError: () => {
      clearAuth();             // no redirect here
      setInitialCheckDone(true);
    },
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading: isPending || !initialCheckDone,
        logout,
        mutate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
