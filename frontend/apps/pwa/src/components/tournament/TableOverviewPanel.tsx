import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Users, ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableOverviewPanelProps {
  tables: Record<string, number> | undefined;
  activeTableId: string | null;
  onSelectTable: (tableId: string) => void;
  isMobile?: boolean;
  isSpectator?: boolean;
}

export function TableOverviewPanel({
  tables = {},
  activeTableId,
  onSelectTable,
  isMobile = false,
  isSpectator = false,
}: TableOverviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableEntries = Object.entries(tables);
  const totalPlayers = tableEntries.reduce((sum, [, count]) => sum + count, 0);

  const virtualizer = useVirtualizer({
    count: tableEntries.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  if (tableEntries.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isMobile ? 20 : -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden',
        isMobile ? 'w-full' : 'w-48'
      )}
    >
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Tables ({tableEntries.length})
        </span>
        <span className="font-data-mono text-xs text-on-surface-variant">
          {totalPlayers} players
        </span>
      </div>

      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto p-1"
        style={{ position: 'relative' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const [tableId, playerCount] = tableEntries[virtualItem.index];
            const isActive = tableId === activeTableId;
            return (
              <button
                key={tableId}
                type="button"
                onClick={() => onSelectTable(tableId)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left absolute top-0 left-0',
                  isActive
                    ? 'bg-tertiary/10 border border-tertiary/20'
                    : 'hover:bg-white/5'
                )}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-data-mono text-xs text-on-surface">
                    Table {tableId.slice(0, 6)}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-on-surface-variant/60" />
                  <span className="font-data-mono text-xs text-on-surface-variant">
                    {playerCount}
                  </span>
                  {isActive && <ChevronRight className="w-3 h-3 text-tertiary" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
