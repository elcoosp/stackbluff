import { type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { rail, railLayers } from '../tokens';
import { InsetRing } from './InsetRing';

export interface NativeTableRailProps {
  /** Mobile radii (40/38/35) vs desktop radii (140/138/134). */
  isMobile?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wooden rail — outermost table layer (PWA z-0). Vertical metal-gradient
 * (7 stops), 1px white/0.08 border with brighter top edge, inset-2px sheen
 * overlay, inset-6px hairline + dark inner rings, and a deep outer shadow.
 * Values copied EXACTLY from PWA TableFelt.tsx TableRail.
 */
export function NativeTableRail({ isMobile = true, style }: NativeTableRailProps) {
  const r = isMobile ? rail.radiusMobile : rail.radiusDesktop;
  const [r1, r2] = isMobile ? railLayers.innerRadiiMobile : railLayers.innerRadiiDesktop;

  return (
    <View
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        {
          borderRadius: r,
          borderWidth: 1,
          borderColor: rail.borderColor,
          // '0 20px 60px rgba(0,0,0,0.9)' approximation (RN single shadow)
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.9,
          shadowRadius: 60,
          elevation: 24,
        },
        style,
      ]}
    >
      {/* clip layer (shadows render only when the view does not clip) */}
      <View style={{ flex: 1, borderRadius: r, overflow: 'hidden' }}>
        {/* Base vertical metal gradient */}
        <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="sbRailGradient" x1="0" y1="0" x2="0" y2="1">
              {rail.gradientStops.map((stop, i) => (
                <Stop
                  key={`${stop}-${rail.gradientPositions[i]}`}
                  offset={rail.gradientPositions[i]}
                  stopColor={stop}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sbRailGradient)" />
        </Svg>

        {/* Top edge highlight (borderTopColor rgba(255,255,255,0.15)) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: railLayers.topHighlight,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: railLayers.bottomHighlight,
          }}
        />

        {/* inset-[2px] sheen overlay */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            right: 2,
            bottom: 2,
            borderRadius: r1,
            overflow: 'hidden',
          }}
        >
          <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="sbRailSheen" x1="0" y1="0" x2="0" y2="1">
                {railLayers.sheenStops.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sbRailSheen)" />
          </Svg>
          {railLayers.innerShadows.map((s) => (
            <InsetRing
              key={`shadow-${s.depth}`}
              radius={r1}
              depth={s.depth}
              color={`rgba(0,0,0,${s.alpha})`}
            />
          ))}
        </View>

        {/* inset-[6px] hairline + inner rings */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            bottom: 6,
            borderRadius: r2,
            borderWidth: 1,
            borderColor: railLayers.hairline,
          }}
        >
          {railLayers.innerRings.map((ring) => (
            <InsetRing
              key={`ring-${ring.depth}`}
              radius={r2}
              depth={ring.depth}
              color={`rgba(0,0,0,${ring.alpha})`}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
