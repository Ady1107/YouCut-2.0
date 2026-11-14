export type RouteId = 'home' | 'youtube' | 'instagram' | 'facebook' | 'queue' | 'history' | 'settings';

export interface RouteParams {
  url?: string;
  autoFetch?: boolean;
}

export interface NavigationContextType {
  currentRoute: RouteId;
  params: RouteParams;
  navigate: (route: RouteId, params?: RouteParams) => void;
  queueCount: number;
  status: {
    state: 'ready' | 'fetching' | 'downloading' | 'update';
    text?: string;
    count?: { n: number; m: number };
  };
  setStatus: (status: NavigationContextType['status']) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}
