import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  QueueItem,
  QueueGroup,
  QueueStatePayload
} from '../../../shared/types';

export interface QueueContextType {
  items: QueueItem[];
  groups: QueueGroup[];
  order: string[];
  overallSpeedBps: number;
  overallSpeedFormatted: string;
  overallEtaSec: number;
  overallEtaFormatted: string;
  waitingCount: number;
  activeCount: number;
  doneCount: number;
  failedCount: number;
  warningCount: number;
  cooldownUntil?: number;
  cooldownReason?: string;
  speedHistory: number[];
  allUnfinishedCount: number;

  // Actions
  addItem: (item: any) => Promise<QueueItem>;
  addGroup: (group: QueueGroup, children: QueueItem[]) => Promise<void>;
  pauseItem: (id: string) => Promise<void>;
  resumeItem: (id: string) => Promise<void>;
  cancelItem: (id: string) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  reorder: (newOrder: string[]) => Promise<void>;
  startNow: (id: string) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  resumeQueueCooldown: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  toggleGroupCollapse: (groupId: string) => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [groups, setGroups] = useState<QueueGroup[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [overallSpeedBps, setOverallSpeedBps] = useState<number>(0);
  const [overallSpeedFormatted, setOverallSpeedFormatted] = useState<string>('0 MB/s');
  const [overallEtaSec, setOverallEtaSec] = useState<number>(0);
  const [overallEtaFormatted, setOverallEtaFormatted] = useState<string>('—');
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [doneCount, setDoneCount] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | undefined>(undefined);
  const [cooldownReason, setCooldownReason] = useState<string | undefined>(undefined);
  const [speedHistory, setSpeedHistory] = useState<number[]>(new Array(21).fill(0));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const applyPayload = useCallback((payload: QueueStatePayload | QueueItem[]) => {
    if (Array.isArray(payload)) {
      setItems(payload);
      setOrder((prev) => (prev.length > 0 ? prev : payload.map((i) => i.id)));
      const waiting = payload.filter((i) => i.status === 'waiting');
      const active = payload.filter((i) => i.status === 'downloading');
      const done = payload.filter((i) => i.status === 'done');
      const warning = payload.filter((i) => i.status === 'warning');
      const failed = payload.filter((i) => i.status === 'failed');
      setWaitingCount(waiting.length);
      setActiveCount(active.length);
      setDoneCount(done.length);
      setWarningCount(warning.length);
      setFailedCount(failed.length);
      return;
    }

    if (payload && typeof payload === 'object') {
      setItems(payload.items || []);
      setGroups(payload.groups || []);
      setOrder(payload.order || []);
      setOverallSpeedBps(payload.overallSpeedBps || 0);
      setOverallSpeedFormatted(payload.overallSpeedFormatted || '—');
      setOverallEtaSec(payload.overallEtaSec || 0);
      setOverallEtaFormatted(payload.overallEtaFormatted || '—');
      setWaitingCount(payload.waitingCount || 0);
      setActiveCount(payload.activeCount || 0);
      setDoneCount(payload.doneCount || 0);
      setWarningCount(payload.warningCount || 0);
      setFailedCount(payload.failedCount || 0);
      setCooldownUntil(payload.cooldownUntil);
      setCooldownReason(payload.cooldownReason);
      if (Array.isArray(payload.speedHistory)) {
        setSpeedHistory(payload.speedHistory);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getQueue) {
      window.api.getQueue().then(applyPayload).catch(console.error);
    }

    if (typeof window !== 'undefined' && window.api?.onQueueUpdate) {
      const unsub = window.api.onQueueUpdate((payload) => {
        applyPayload(payload);
      });
      return unsub;
    }
  }, [applyPayload]);

  const addItem = async (item: any): Promise<QueueItem> => {
    if (window.api?.addToQueue) {
      return await window.api.addToQueue(item);
    }
    throw new Error('Queue API not available');
  };

  const addGroup = async (group: QueueGroup, childrenList: QueueItem[]): Promise<void> => {
    if (window.api?.addGroupToQueue) {
      await window.api.addGroupToQueue(group, childrenList);
    }
  };

  const pauseItem = async (id: string): Promise<void> => {
    if (window.api?.pauseQueueItem) await window.api.pauseQueueItem(id);
  };

  const resumeItem = async (id: string): Promise<void> => {
    if (window.api?.resumeQueueItem) await window.api.resumeQueueItem(id);
  };

  const cancelItem = async (id: string): Promise<void> => {
    if (window.api?.cancelQueueItem) await window.api.cancelQueueItem(id);
  };

  const retryItem = async (id: string): Promise<void> => {
    if (window.api?.retryQueueItem) await window.api.retryQueueItem(id);
  };

  const removeItem = async (id: string): Promise<void> => {
    if (window.api?.removeQueueItem) await window.api.removeQueueItem(id);
  };

  const reorder = async (newOrder: string[]): Promise<void> => {
    setOrder(newOrder);
    if (window.api?.reorderQueue) await window.api.reorderQueue(newOrder);
  };

  const startNow = async (id: string): Promise<void> => {
    if (window.api?.startNowQueueItem) await window.api.startNowQueueItem(id);
  };

  const pauseAll = async (): Promise<void> => {
    if (window.api?.pauseAllQueue) await window.api.pauseAllQueue();
  };

  const resumeAll = async (): Promise<void> => {
    if (window.api?.resumeAllQueue) await window.api.resumeAllQueue();
  };

  const resumeQueueCooldown = async (): Promise<void> => {
    if (window.api?.resumeQueueCooldown) await window.api.resumeQueueCooldown();
  };

  const clearCompleted = async (): Promise<void> => {
    if (window.api?.clearCompletedQueue) await window.api.clearCompletedQueue();
  };

  const toggleGroupCollapse = (groupId: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const allUnfinishedCount = activeCount + waitingCount;

  return (
    <QueueContext.Provider
      value={{
        items,
        groups: groups.map((g) => ({ ...g, collapsed: collapsedGroups.has(g.id) })),
        order,
        overallSpeedBps,
        overallSpeedFormatted,
        overallEtaSec,
        overallEtaFormatted,
        waitingCount,
        activeCount,
        doneCount,
        warningCount,
        failedCount,
        cooldownUntil,
        cooldownReason,
        speedHistory,
        allUnfinishedCount,
        addItem,
        addGroup,
        pauseItem,
        resumeItem,
        cancelItem,
        retryItem,
        removeItem,
        reorder,
        startNow,
        pauseAll,
        resumeAll,
        resumeQueueCooldown,
        clearCompleted,
        toggleGroupCollapse
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export function useQueue(): QueueContextType {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
}
