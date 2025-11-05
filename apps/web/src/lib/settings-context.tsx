'use client';

import { ISetting, ISettingResponse } from '@elearning/types';
import { createContext, useContext, type ReactNode } from 'react';

interface ISettingsContextType {
  settings: ISettingResponse | null;
  isLoading: boolean;
  error: Error | null;
}

const SettingsContext = createContext<ISettingsContextType | undefined>(undefined);

export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings: ISettingResponse;
}) {
  // We could add methods here to update settings if needed
  const value = {
    settings: initialSettings,
    isLoading: false,
    error: null,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
