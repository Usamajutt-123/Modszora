'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'modverse-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Inlined in <head> to apply the theme before first paint (no FOUC). */
export const themeInitScript = `
(function(){
  try {
    var k='${STORAGE_KEY}';
    var s=localStorage.getItem(k);
    var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t=(s==='light'||s==='dark')?s:(m?'dark':'light');
    var r=document.documentElement;
    r.classList.remove('light','dark');
    r.classList.add(t);
    r.style.colorScheme=t;
  } catch(e){
    document.documentElement.classList.add('dark');
  }
  document.documentElement.classList.remove('mv-theme-loading');
})();
`;

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#070912' : '#f7f8fc');
}

export function ThemeProvider({ children, defaultTheme = 'system' }: { children: ReactNode; defaultTheme?: ThemeMode }) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  // Hydrate from storage once mounted.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? defaultTheme;
    setThemeState(stored);
  }, [defaultTheme]);

  // Resolve `system` against the media query and keep it live (auto switching).
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const compute = (): ResolvedTheme => (theme === 'system' ? (mql.matches ? 'dark' : 'light') : theme);

    const next = compute();
    setResolved(next);
    applyTheme(next);

    if (theme !== 'system') return;
    const onChange = () => {
      const r = mql.matches ? 'dark' : 'light';
      setResolved(r);
      applyTheme(r);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      if (t === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage disabled — session only */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
