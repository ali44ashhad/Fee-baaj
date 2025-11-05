'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MuteContextValue {
  muted: boolean;
  toggleMute: () => void;
}

const MuteContext = createContext<MuteContextValue | undefined>(undefined);

export function MuteProvider({ children }: { children: ReactNode }) {
  // start all videos muted by default; no localStorage
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    setMuted((m) => !m);
  };

  return (
    <MuteContext.Provider value={{ muted, toggleMute }}>
      {children}
    </MuteContext.Provider>
  );
}

export const useMute = () => {
  const ctx = useContext(MuteContext);
  if (!ctx) throw new Error('useMute must be inside MuteProvider');
  return ctx;
};
