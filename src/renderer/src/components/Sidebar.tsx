import React from 'react';
import { useNavigation } from '../context/NavigationContext';
import { RouteId } from '../types/routes';
import {
  ScissorsIcon,
  HomeIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  QueueIcon,
  HistoryIcon,
  SettingsIcon
} from './Icons';
import { StatusPill } from './Badge';

export const Sidebar: React.FC = () => {
  const { currentRoute, navigate, queueCount, status } = useNavigation();

  interface NavItem {
    id: RouteId;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    badge?: number;
  }

  const primaryItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: HomeIcon }
  ];

  const platformItems: NavItem[] = [
    { id: 'youtube', label: 'YouTube', icon: YouTubeIcon },
    { id: 'instagram', label: 'Instagram', icon: InstagramIcon },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon }
  ];

  const secondaryItems: NavItem[] = [
    { id: 'queue', label: 'Queue', icon: QueueIcon, badge: queueCount },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  const renderNavButton = (item: NavItem) => {
    const isActive = currentRoute === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        type="button"
        data-route={item.id}
        onClick={() => navigate(item.id)}
        className={`w-full flex items-center gap-3 h-11 px-3.5 rounded-[12px] text-sm text-left transition-all select-none ${
          isActive
            ? 'border border-[#2A2E3B] bg-[#1B1E27] text-foreground font-semibold shadow-sm'
            : 'border border-transparent bg-transparent text-foreground-muted font-medium hover:text-foreground hover:bg-[#14161D]'
        }`}
      >
        <Icon
          size={18}
          className={isActive ? 'text-accent' : 'currentColor'}
          strokeWidth={isActive ? 2.4 : 2}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-accent text-[#1A0805] text-[11px] font-bold">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-[195px] flex-none box-border p-6 px-3.5 bg-sidebar border-r border-border-subtle flex flex-col gap-5 select-none h-full">
      {/* Brand Header */}
      <div
        className="flex items-center gap-3 px-2 mb-2 cursor-pointer active:scale-95 transition-transform"
        onClick={() => navigate('home')}
      >
        <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center shadow-md">
          <ScissorsIcon size={20} className="stroke-[#1A0805]" strokeWidth={2.4} />
        </div>
        <div className="font-display font-bold text-xl tracking-tight text-foreground">
          YouCut
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex flex-col gap-1 flex-1">
        {primaryItems.map(renderNavButton)}

        <div className="px-3.5 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider text-foreground-muted select-none">
          PLATFORMS
        </div>
        {platformItems.map(renderNavButton)}

        <div className="h-[1px] bg-border-subtle my-3" />

        {secondaryItems.map(renderNavButton)}
      </nav>

      {/* Status Pill Bottom Left */}
      <div className="mt-auto pt-2">
        <StatusPill state={status.state} text={status.text} count={status.count} />
      </div>
    </aside>
  );
};
