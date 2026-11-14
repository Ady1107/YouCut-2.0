import React, { createContext, useContext, useState, ReactNode } from 'react';
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

  const navigate = (route: RouteId, newParams: RouteParams = {}) => {
    setCurrentRoute(route);
    setParams(newParams);
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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
