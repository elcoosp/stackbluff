import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { glassHub } from '../tokens';

export interface GlassHubProps {
  children?: ReactNode;
  /** Active turn — emerald border + glow shadow. */
  active?: boolean;
  /** Layout direction of quick actions (default 'row'). */
  direction?: 'row' | 'column';
  /** Gap between actions in px. */
  gap?: number;
  /** Inner padding in px. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Glass material cluster of quick actions — port of PWA GlassHub + the
 * `.glass-hub` CSS: rgba(10,10,10,0.85) bg, 1px white/10 border (brighter
 * top edge), rounded-xl, deep shadow; `active` swaps in the tertiary/60
 * border + emerald glow. RN has no backdrop blur — the bg alpha is kept and
 * the blur itself is dropped (deviation in worklog).
 */
export function GlassHub({
  children,
  active = false,
  direction = 'row',
  gap = 8,
  padding = 10,
  style,
}: GlassHubProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          alignItems: 'center',
          gap,
          padding,
          borderRadius: glassHub.radius,
          backgroundColor: glassHub.bg,
          borderWidth: 1,
          borderColor: active ? glassHub.activeBorder : glassHub.border,
          // .glass-hub shadow / active glow (RN single shadow slot)
          shadowColor: active ? glassHub.activeGlow : glassHub.shadow,
          shadowOffset: { width: 0, height: active ? 0 : 8 },
          shadowOpacity: active ? 0.5 : 0.8,
          shadowRadius: active ? 15 : 32,
          elevation: active ? 12 : 16,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* top edge highlight (border-top-color white/15) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: glassHub.borderTop,
        }}
      />
      {children}
    </View>
  );
}
