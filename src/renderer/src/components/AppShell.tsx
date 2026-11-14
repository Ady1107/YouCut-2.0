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

  const renderActiveRoute = () => {
    switch (currentRoute) {
      case 'home':
        return <Home />;
      case 'youtube':
        return <YouTubeRoute />;
      case 'instagram':
        return <InstagramRoute />;
      case 'facebook':
        return <FacebookRoute />;
      case 'queue':
        return <QueueRoute />;
      case 'history':
        return <HistoryRoute />;
      case 'settings':
        return <SettingsRoute />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-background text-foreground flex antialiased select-none font-sans">
      {/* Fixed Left Navigation Sidebar (~195px) */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background relative">
        {renderActiveRoute()}
      </main>
    </div>
  );
};
