'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  /** โหมดที่แสดงจริงหลังคำนวณแล้ว */
  resolved: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'app-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return systemPrefersDark();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setThemeState(saved);
    }
  }, []);

  const apply = useCallback((pref: ThemePreference) => {
    const dark = resolveDark(pref);
    setResolved(dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    apply(theme);
  }, [theme, apply]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolved,
    }),
    [theme, setTheme, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
