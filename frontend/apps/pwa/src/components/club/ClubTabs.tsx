import type { ReactNode } from 'react';

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
      <div className="flex gap-2 mb-6 border-b border-white/10">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {children}
    </>
  );
}

export type { TabKey, Tab };
