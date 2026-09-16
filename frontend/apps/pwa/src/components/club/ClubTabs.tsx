import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TabKey = 'leaderboard' | 'tournaments' | 'settings';

interface Tab {
  key: TabKey;
  label: string;
  visible: boolean;
}

interface ClubTabsProps {
  tabs: Tab[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}

export function ClubTabs({ tabs, activeTab, onTabChange, children }: ClubTabsProps) {
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <>
      {/* Tab Navigation */}
      <div className="flex w-full gap-1 raised-panel rounded-2xl p-1.5 h-auto mb-6">
        {visibleTabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-surface-container-high text-on-surface shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_2px_6px_rgba(0,0,0,0.3)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.05]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {children}
    </>
  );
}

export type { Tab, TabKey };
