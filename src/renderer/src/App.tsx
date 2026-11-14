import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NavigationProvider>
          <AppShell />
        </NavigationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
