import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RouteId, RouteParams, NavigationContextType } from '../types/routes';
import { Toast, ToastProps } from '../components/Toast';

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<RouteId>('home');
  const [params, setParams] = useState<RouteParams>({});
  const [queueCount, setQueueCount] = useState<number>(0);
  const [status, setStatus] = useState<NavigationContextType['status']>({
    state: 'ready',
    text: 'Ready to clip'
  });
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'error' }>>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getQueue) {
      window.api.getQueue().then((items) => {
        const active = items.filter((i) => i.status === 'queued' || i.status === 'downloading');
        setQueueCount(active.length);
      }).catch(() => {});
    }

    if (typeof window !== 'undefined' && window.api?.onQueueUpdate) {
      const unsub = window.api.onQueueUpdate((items) => {
        const active = items.filter((i) => i.status === 'queued' || i.status === 'downloading');
        setQueueCount(active.length);
        const downloading = items.find((i) => i.status === 'downloading');
        if (downloading) {
          setStatus({
            state: 'downloading',
            text: `Downloading (${downloading.progress}%)`
          });
        } else {
          setStatus({
            state: 'ready',
            text: 'Ready to clip'
          });
        }
      });
      return unsub;
    }
  }, []);

  const navigate = (route: RouteId, newParams: RouteParams = {}) => {
    setCurrentRoute(route);
    setParams(newParams);
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      // Keep at most 2 recent unique toasts to prevent UI clutter
      const filtered = prev.filter((t) => t.message !== message).slice(-1);
      return [...filtered, { id, message, type }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        params,
        navigate,
        queueCount,
        status,
        setStatus,
        showToast
      }}
    >
      {children}
      {/* Toast notifications container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            type={t.type}
            message={t.message}
            onClose={removeToast}
          />
        ))}
      </div>
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
