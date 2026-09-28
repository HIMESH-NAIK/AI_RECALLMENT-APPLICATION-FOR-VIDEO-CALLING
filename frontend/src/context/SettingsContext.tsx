import React, { createContext, useContext, useEffect, useState } from 'react';

type Settings = {
  effectsEnabled: boolean;
  setEffectsEnabled: (v: boolean) => void;
};

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('effectsEnabled');
      return v === null ? true : v === 'true';
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('effectsEnabled', effectsEnabled ? 'true' : 'false');
    } catch (e) {}
  }, [effectsEnabled]);

  return (
    <SettingsContext.Provider value={{ effectsEnabled, setEffectsEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
