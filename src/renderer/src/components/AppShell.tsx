import React from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Sidebar } from './Sidebar';
import { Home } from '../routes/Home';
import { YouTubeRoute } from '../routes/YouTube';
import { InstagramRoute } from '../routes/Instagram';
import { FacebookRoute } from '../routes/Facebook';
import { QueueRoute } from '../routes/Queue';
import { HistoryRoute } from '../routes/History';
import { SettingsRoute } from '../routes/Settings';

export const AppShell: React.FC = () => {
  const { currentRoute } = useNavigation();

  return (
    <div className="w-screen h-screen overflow-hidden bg-background text-foreground flex antialiased select-none font-sans">
      {/* Fixed Left Navigation Sidebar (~195px) */}
      <Sidebar />

      {/* Main Content Area - Preserves route state across tab switches so user work is never reset */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background relative">
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'home' ? '' : 'hidden'}`}>
          <Home />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'youtube' ? '' : 'hidden'}`}>
          <YouTubeRoute />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'instagram' ? '' : 'hidden'}`}>
          <InstagramRoute />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'facebook' ? '' : 'hidden'}`}>
          <FacebookRoute />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'queue' ? '' : 'hidden'}`}>
          <QueueRoute />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'history' ? '' : 'hidden'}`}>
          <HistoryRoute />
        </div>
        <div className={`flex-1 h-full min-w-0 overflow-hidden flex flex-col ${currentRoute === 'settings' ? '' : 'hidden'}`}>
          <SettingsRoute />
        </div>
      </main>
    </div>
  );
};
