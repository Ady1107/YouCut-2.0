import React, { useState, useEffect, useMemo } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { useQueue } from '../context/QueueContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { QueueIcon, ScissorsIcon, TrashIcon, PauseIcon, PlayIcon } from '../components/Icons';
import { Sparkline } from '../components/queue/Sparkline';
import { FilterTabs, QueueFilterTab } from '../components/queue/FilterTabs';
import { ActiveItemCard } from '../components/queue/ActiveItemCard';
import { WaitingCard } from '../components/queue/WaitingCard';
import { DoneCard } from '../components/queue/DoneCard';
import { FailedCard } from '../components/queue/FailedCard';
import { PlaylistGroupCard } from '../components/queue/PlaylistGroupCard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCardWrapperProps {
  id: string;
  children: (dragHandleProps: any) => React.ReactNode;
}

const SortableCardWrapper: React.FC<SortableCardWrapperProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
};

export const QueueRoute: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const {
    items,
    groups,
    order,
    overallSpeedFormatted,
    overallEtaFormatted,
    waitingCount,
    activeCount,
    doneCount,
    failedCount,
    speedHistory,
    pauseItem,
    resumeItem,
    cancelItem,
    retryFailedGroup,
    cancelRemainingGroup,
    retryItem,
    removeItem,
    reorder,
    startNow,
    pauseAll,
    resumeAll,
    resumeQueueCooldown,
    clearCompleted,
    cooldownUntil,
    cooldownReason
  } = useQueue();

  const [cooldownSec, setCooldownSec] = useState<number>(0);

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) {
      setCooldownSec(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSec(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const formatCooldown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Filter tab state persisted in localStorage
  const [activeFilter, setActiveFilter] = useState<QueueFilterTab>(() => {
    try {
      const saved = localStorage.getItem('youcut_queue_filter');
      if (saved && ['all', 'downloading', 'waiting', 'done', 'failed'].includes(saved)) {
        return saved as QueueFilterTab;
      }
    } catch {}
    return 'all';
  });

  const handleSelectFilter = (tab: QueueFilterTab) => {
    setActiveFilter(tab);
    try {
      localStorage.setItem('youcut_queue_filter', tab);
    } catch {}
  };

  const handleShowInFolder = async (filePath?: string) => {
    if (!filePath) return;
    try {
      if (window.api?.openFolder) {
        const ok = await window.api.openFolder(filePath);
        if (!ok) showToast('Could not open folder (file may have been moved)', 'error');
      }
    } catch {
      showToast('Could not open folder', 'error');
    }
  };

  const handleOpenFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      if (window.api?.openFile) {
        const ok = await window.api.openFile(filePath);
        if (!ok) showToast('Could not play file (file may have been moved)', 'error');
      }
    } catch {
      showToast('Could not play file', 'error');
    }
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      if (oldIndex > -1 && newIndex > -1) {
        const newOrder = arrayMove(order, oldIndex, newIndex);
        reorder(newOrder);
      }
    }
  };

  // Grouped cards list structure
  const allCards = useMemo(() => {
    const cards: Array<
      | { type: 'group'; group: (typeof groups)[0]; children: typeof items }
      | { type: 'item'; item: (typeof items)[0] }
    > = [];

    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const standaloneItemMap = new Map(items.filter((i) => !i.groupId).map((i) => [i.id, i]));

    for (const id of order) {
      if (groupMap.has(id)) {
        const g = groupMap.get(id)!;
        const childItems = items.filter((i) => i.groupId === g.id);
        cards.push({ type: 'group', group: g, children: childItems });
        groupMap.delete(id);
      } else if (standaloneItemMap.has(id)) {
        cards.push({ type: 'item', item: standaloneItemMap.get(id)! });
        standaloneItemMap.delete(id);
      }
    }

    // Append any newly added groups or standalone items not yet in order
    for (const g of groupMap.values()) {
      const childItems = items.filter((i) => i.groupId === g.id);
      cards.push({ type: 'group', group: g, children: childItems });
    }
    for (const i of standaloneItemMap.values()) {
      cards.push({ type: 'item', item: i });
    }

    return cards;
  }, [groups, items, order]);

  // Apply tab filter
  const filteredCards = useMemo(() => {
    if (activeFilter === 'all') return allCards;

    return allCards.filter((card) => {
      if (card.type === 'item') {
        if (activeFilter === 'downloading') return card.item.status === 'downloading' || card.item.status === 'paused';
        if (activeFilter === 'waiting') return card.item.status === 'waiting';
        if (activeFilter === 'done') return card.item.status === 'done';
        if (activeFilter === 'failed') return card.item.status === 'failed';
        return true;
      } else {
        // Group matches if any child matches status
        if (activeFilter === 'downloading') {
          return card.children.some((c) => c.status === 'downloading' || c.status === 'paused');
        }
        if (activeFilter === 'waiting') {
          return card.children.some((c) => c.status === 'waiting');
        }
        if (activeFilter === 'done') {
          return card.children.every((c) => c.status === 'done');
        }
        if (activeFilter === 'failed') {
          return card.children.some((c) => c.status === 'failed');
        }
        return true;
      }
    });
  }, [allCards, activeFilter]);

  const totalCardCount = allCards.length;
  const isAnyPaused = items.some((i) => i.status === 'paused');
  const isAnyDownloading = items.some((i) => i.status === 'downloading');

  return (
    <div className="flex-1 flex flex-col gap-5 p-6 sm:p-8 overflow-y-auto max-w-5xl mx-auto w-full box-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Download Queue
            </h1>
            <span className="px-3 py-0.5 rounded-full bg-surface border border-border text-foreground-subtle text-xs font-semibold select-none">
              {groups.length > 0
                ? `${items.length} items (${items.filter((i) => !i.groupId).length} ${items.filter((i) => !i.groupId).length === 1 ? 'video' : 'videos'} + ${groups.length} ${groups.length === 1 ? 'playlist' : 'playlists'} of ${items.filter((i) => Boolean(i.groupId)).length})`
                : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
            </span>
          </div>
          <p className="text-foreground-muted text-xs">
            Downloads run one after another and are checked automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-none">
          {isAnyPaused ? (
            <Button
              variant="secondary"
              size="md"
              onClick={resumeAll}
              className="flex items-center gap-2 font-medium"
            >
              <PlayIcon size={14} />
              <span>Resume all</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              disabled={!isAnyDownloading && waitingCount === 0}
              onClick={pauseAll}
              className="flex items-center gap-2 font-medium disabled:opacity-40"
            >
              <PauseIcon size={14} />
              <span>Pause all</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="md"
            disabled={doneCount === 0}
            onClick={clearCompleted}
            className="flex items-center gap-1.5 text-foreground-muted hover:text-foreground disabled:opacity-30"
          >
            <span>Clear completed</span>
          </Button>
        </div>
      </div>

      {/* Rate limit cooldown countdown banner (D2) */}
      {cooldownSec > 0 && (
        <div className="p-3.5 sm:p-4 rounded-[16px] bg-status-dangerTint border border-status-danger/40 flex items-center justify-between shadow-sm gap-3">
          <div className="flex items-center gap-2.5 text-status-danger font-medium text-xs sm:text-sm flex-wrap">
            <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse flex-none" />
            <span>
              {cooldownReason || 'Rate limited by platform'}. Resuming in{' '}
              <strong className="font-mono font-bold">{formatCooldown(cooldownSec)}</strong>
            </span>
            <div className="relative group/cooldowntip inline-flex items-center cursor-help">
              <span
                className="w-4 h-4 rounded-full bg-status-danger/20 border border-status-danger/50 text-status-danger flex items-center justify-center text-[10px] font-bold select-none"
                title="Why is there a timer?"
              >
                !
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover/cooldowntip:block z-50 w-72 p-3 rounded-[10px] bg-[#14161D] border border-border-strong text-[11px] text-foreground-muted font-normal shadow-2xl pointer-events-none leading-relaxed">
                <span className="font-semibold text-foreground block mb-1">
                  Why is this safety timer active?
                </span>
                YouTube throttled requests from your network. This short safety pause prevents YouTube from temporarily or permanently banning your IP address. Click &quot;Resume now&quot; if you want to skip the wait.
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={resumeQueueCooldown}
            className="text-xs font-semibold flex-none"
          >
            Resume now
          </Button>
        </div>
      )}

      {/* Overview Strip Card */}
      <Card className="p-4 sm:p-5 rounded-[18px] bg-card border-border-strong flex items-center justify-between shadow-sm">
        {/* Left: 3 Stats Columns */}
        <div className="grid grid-cols-3 gap-6 sm:gap-10">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wider select-none mb-1">
              Speed
            </span>
            <span className="font-display font-bold text-xl sm:text-2xl text-foreground font-mono">
              {overallSpeedFormatted}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wider select-none mb-1">
              Time left
            </span>
            <span className="font-display font-bold text-xl sm:text-2xl text-foreground font-mono">
              {overallEtaFormatted}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wider select-none mb-1">
              Waiting
            </span>
            <span className="font-display font-bold text-xl sm:text-2xl text-foreground font-mono">
              {waitingCount} {waitingCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Right: Real-time SVG Sparkline */}
        <div className="flex-none hidden sm:block">
          <Sparkline samples={speedHistory} width={190} height={52} />
        </div>
      </Card>

      {/* Filter Tabs */}
      <FilterTabs
        activeTab={activeFilter}
        counts={{
          all: items.length,
          downloading: activeCount,
          waiting: waitingCount,
          done: doneCount,
          failed: failedCount
        }}
        onSelect={handleSelectFilter}
      />

      {/* Queue Body List */}
      {filteredCards.length === 0 ? (
        <Card className="p-12 rounded-[18px] bg-card border-border-strong flex flex-col items-center justify-center text-center gap-4 my-auto shadow-sm">
          <div className="w-16 h-16 rounded-[14px] bg-surface border border-border flex items-center justify-center text-foreground-muted">
            <QueueIcon size={32} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Nothing in the queue
            </h3>
            <p className="text-foreground-muted text-xs max-w-md leading-relaxed">
              When you clip videos or download YouTube playlists, they will appear here and process sequentially with high-speed fragments.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('youtube')}
            className="flex items-center gap-2 mt-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <ScissorsIcon size={16} />
            <span>Go to Download</span>
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredCards.map((c) => (c.type === 'group' ? c.group.id : c.item.id))}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3.5 pb-8">
              {filteredCards.map((card, idx) => {
                if (card.type === 'group') {
                  return (
                    <SortableCardWrapper key={card.group.id} id={card.group.id}>
                      {() => (
                        <PlaylistGroupCard
                          group={card.group}
                          childrenItems={card.children}
                          onPauseGroup={pauseItem}
                          onResumeGroup={resumeItem}
                          onCancelGroup={cancelItem}
                          onRetryFailedGroup={retryFailedGroup}
                          onCancelRemainingGroup={cancelRemainingGroup}
                          onStartNowItem={startNow}
                          onPauseItem={pauseItem}
                          onResumeItem={resumeItem}
                          onRetryItem={retryItem}
                          onRemoveItem={removeItem}
                          onShowInFolder={handleShowInFolder}
                          onPlay={handleOpenFile}
                        />
                      )}
                    </SortableCardWrapper>
                  );
                }

                const item = card.item;
                const isDownloading = item.status === 'downloading' || item.status === 'paused';
                const isWaiting = item.status === 'waiting';
                const isDone = item.status === 'done';
                const isFailed = item.status === 'failed';

                if (isDownloading) {
                  return (
                    <SortableCardWrapper key={item.id} id={item.id}>
                      {() => (
                        <ActiveItemCard
                          item={item}
                          onPause={pauseItem}
                          onResume={resumeItem}
                          onCancel={cancelItem}
                        />
                      )}
                    </SortableCardWrapper>
                  );
                }

                if (isWaiting) {
                  return (
                    <SortableCardWrapper key={item.id} id={item.id}>
                      {(dragHandleProps) => (
                        <WaitingCard
                          item={item}
                          queueIndex={idx}
                          onStartNow={startNow}
                          onRemove={removeItem}
                          dragHandleProps={dragHandleProps}
                        />
                      )}
                    </SortableCardWrapper>
                  );
                }

                if (isDone || item.status === 'warning') {
                  return (
                    <SortableCardWrapper key={item.id} id={item.id}>
                      {() => (
                        <DoneCard
                          item={item}
                          onShowInFolder={handleShowInFolder}
                          onPlay={handleOpenFile}
                        />
                      )}
                    </SortableCardWrapper>
                  );
                }

                if (isFailed) {
                  return (
                    <SortableCardWrapper key={item.id} id={item.id}>
                      {() => (
                        <FailedCard
                          item={item}
                          onRetry={retryItem}
                          onRemove={removeItem}
                        />
                      )}
                    </SortableCardWrapper>
                  );
                }

                return null;
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
