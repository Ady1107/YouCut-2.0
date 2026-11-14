import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <NavigationProvider>
        <AppShell />
      </NavigationProvider>
    </ErrorBoundary>
  );
};
