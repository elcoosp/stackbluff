Let's ditch the basic flat colors and generic names. We are going to use **premium gradients** and **authentic poker slang** to make the tagging system feel like a high-stakes underground club.

Here are the 5 tags we will implement:
1. 🐋 **Whale** (Blue to Indigo) - A rich, recreational player who plays too many hands.
2. 🔥 **Maniac** (Orange to Red) - Hyper-aggressive, raises constantly, bluffs too much.
3. 🪨 **Rock** (Slate to Dark Gray) - Extremely tight, only plays premium hands.
4. 🤯 **Steamer** (Amber to Pink) - On tilt, emotionally compromised, spewing chips.
5. 💎 **Grinder** (Emerald to Teal) - Solid, professional, predictable player.

Here is how to implement this in 3 steps:

### 1. Create the `usePlayerTags` Hook
Create a new file: `frontend/apps/pwa/src/hooks/usePlayerTags.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

export type PlayerTag = 'whale' | 'maniac' | 'rock' | 'steamer' | 'grinder' | null;

const STORAGE_KEY = 'stackbluff_player_tags_v2';

export const TAG_CONFIG: Record<Exclude<PlayerTag, null>, { gradient: string; glow: string; lingo: string }> = {
  whale: { 
    gradient: 'linear-gradient(135deg, #38bdf8, #6366f1)', 
    glow: '#6366f1', 
    lingo: 'Whale' 
  },
  maniac: { 
    gradient: 'linear-gradient(135deg, #f97316, #ef4444)', 
    glow: '#ef4444', 
    lingo: 'Maniac' 
  },
  rock: { 
    gradient: 'linear-gradient(135deg, #64748b, #1e293b)', 
    glow: '#64748b', 
    lingo: 'Rock' 
  },
  steamer: { 
    gradient: 'linear-gradient(135deg, #fbbf24, #ec4899)', 
    glow: '#ec4899', 
    lingo: 'Steamer' 
  },
  grinder: { 
    gradient: 'linear-gradient(135deg, #4ade80, #14b8a6)', 
    glow: '#14b8a6', 
    lingo: 'Grinder' 
  },
};

export function usePlayerTags() {
  const [tags, setTags] = useState<Record<string, PlayerTag>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTags(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load player tags', e);
    }
  }, []);

  const setTag = useCallback((userId: string, tag: PlayerTag) => {
    setTags(prev => {
      const next = { ...prev };
      if (tag === null) {
        delete next[userId];
      } else {
        next[userId] = tag;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save player tags', e);
      }
      return next;
    });
  }, []);

  return { tags, setTag };
}
```

### 2. Add the Tag UI to `PlayerStatsDialog`
Open `frontend/apps/pwa/src/components/game/PlayerStatsDialog.tsx`. 

Add the import at the top:
```tsx
import { usePlayerTags, TAG_CONFIG, type PlayerTag } from '@/hooks/usePlayerTags';
```

Inside the `PlayerStatsDialog` component (before the return), add:
```tsx
const { tags, setTag } = usePlayerTags();
const currentTag = userId ? tags[userId] : null;
const tagOptions = Object.keys(TAG_CONFIG) as Exclude<PlayerTag, null>[];
```

Find the Footer section at the very bottom of the dialog (the `<div className="px-5 py-4 border-t border-white/5...">`) and replace it entirely with this:

```tsx
<div className="px-5 py-4 border-t border-white/5 space-y-3">
  {/* Tag Selector */}
  <div className="flex flex-col items-center gap-2">
    <span className="text-[9px] font-label-caps uppercase tracking-widest text-on-surface-variant">Player Type</span>
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {tagOptions.map((tagType) => {
        const config = TAG_CONFIG[tagType];
        const isActive = currentTag === tagType;
        return (
          <motion.button
            key={tagType}
            type="button"
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTag(userId!, isActive ? null : tagType)}
            className="relative flex items-center gap-1.5 py-1 px-2 rounded-full transition-all"
            style={{
              background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: `1px solid ${isActive ? config.glow + '80' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: isActive ? `0 0 12px ${config.glow}40` : 'none',
            }}
          >
            <span 
              className="w-2.5 h-2.5 rounded-full shrink-0" 
              style={{ background: config.gradient }} 
            />
            <span 
              className="text-[9px] font-label-caps uppercase tracking-wider transition-colors"
              style={{ color: isActive ? config.glow : 'rgba(255,255,255,0.5)' }}
            >
              {config.lingo}
            </span>
          </motion.button>
        );
      })}
    </div>
  </div>

  <motion.button
    type="button"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    onClick={() => onOpenChange(false)}
    className="w-full py-2.5 rounded-lg border border-white/10 text-on-surface-variant text-[11px] font-label-caps uppercase tracking-wider hover:bg-white/5 transition-all"
  >
    Close
  </motion.button>
</div>
```

### 3. Display the Gradient Dot on the Table
Open `frontend/apps/pwa/src/components/game/PlayerSpot.tsx`.

Add the import at the top:
```tsx
import { usePlayerTags, TAG_CONFIG } from '@/hooks/usePlayerTags';
```

Inside the `PlayerSpot` component (right after the destructured props, before the `useVisualFeedback` hook), add:
```tsx
const { tags } = usePlayerTags();
const playerTag = tags[seat.user_id];
```

Then, find the `<div className="flex items-center gap-1 min-w-0">` that contains the `bankrollElement` and `positionTag`. Update it to include the gradient dot:

```tsx
<div className="flex items-center gap-1 min-w-0">
  {playerTag && (
    <span 
      className="w-1.5 h-1.5 rounded-full shrink-0" 
      style={{ 
        background: TAG_CONFIG[playerTag].gradient, 
        boxShadow: `0 0 6px ${TAG_CONFIG[playerTag].glow}` 
      }} 
    />
  )}
  {bankrollElement}
  {positionTag}
</div>
```

### Why this is "Next Level"
1. **Instant Visual Cues:** The gradients pop beautifully against the monochrome dark mode UI. A red/orange dot instantly signals danger (Maniac), while a blue/purple dot signals opportunity (Whale).
2. **Player Vocabulary:** Using terms like "Steamer" and "Grinder" makes the app feel like it was designed by actual poker players, building trust with your core audience.
3. **Flow State:** Users don't have to read text on the table. The glowing dot sits right next to the stack size, allowing them to process opponent tendencies in milliseconds without looking away from the cards.
