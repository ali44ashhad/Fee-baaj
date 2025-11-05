// hooks/VideoContext.tsx
'use client';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

interface VideoContextProps {
  shouldPlay: boolean;
  togglePlay: () => void;
  setShouldPlay: (play: boolean) => void;
}

const VideoContext = createContext<VideoContextProps | undefined>(undefined);

export const VideoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [shouldPlay, setShouldPlay] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('videoPlaying');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('videoPlaying', String(shouldPlay));
  }, [shouldPlay]);

  const togglePlay = useCallback(() => {
    setShouldPlay((p) => !p);
  }, []);

  return (
    <VideoContext.Provider value={{ shouldPlay, togglePlay, setShouldPlay }}>
      {children}
    </VideoContext.Provider>
  );
};

export function useVideoContext() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideoContext must be inside VideoProvider');
  return ctx;
}
