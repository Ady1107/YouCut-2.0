import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('youcut_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // Fallback
    }
    return 'dark';
  });

  const [systemIsLight, setSystemIsLight] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return false;
  });

  const resolvedTheme: 'dark' | 'light' = theme === 'system' ? (systemIsLight ? 'light' : 'dark') : theme;

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('youcut_theme', newTheme);
      if (typeof window !== 'undefined' && window.api?.patchSettings) {
        window.api.patchSettings({ appearance: { theme: newTheme } }).catch(() => {});
      }
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const applyTheme = (effective: 'dark' | 'light') => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', effective);
      if (effective === 'light') {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.body.classList.remove('light');
      }
    }
  };

  useEffect(() => {
    // Listen for OS system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = (e: MediaQueryListEvent) => setSystemIsLight(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    // Sync with backend settings if available
    if (typeof window !== 'undefined' && window.api?.getSettings) {
      window.api.getSettings().then((s: any) => {
        if (s?.appearance?.theme && (s.appearance.theme === 'dark' || s.appearance.theme === 'light' || s.appearance.theme === 'system')) {
          setThemeState(s.appearance.theme);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
