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
      <div className="flex w-full gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl h-auto mb-6">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-white/10 text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
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
