/// <reference path="../types/assets.d.ts" />
import type { ReactNode } from 'react';
import { Image, type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import FELT_NOISE from '../../assets/felt-noise.png';
import { felt, feltLayers } from '../tokens';
import { InsetRing } from './InsetRing';

export interface NativeTableFeltProps {
  /** Mobile radius 28 + softened gradient vs desktop radius 100 full-depth. */
  isMobile?: boolean;
  /** Seats / pot / community cards rendered above the felt surface. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Felt surface — inner table layer (PWA z-1). Elliptical radial gradient
 * (SVG viewBox-stretch trick), pre-generated fractal noise PNG at opacity
 * 0.03 (replaces the PWA SVG feTurbulence data-URI), emerald spotlight, and
 * stacked inset-shadow rings. Values copied EXACTLY from PWA TableFelt.tsx.
 *
 * Children are rendered above the felt layers, inside the rounded clip.
 */
export function NativeTableFelt({ isMobile = true, children, style }: NativeTableFeltProps) {
  const r = isMobile ? felt.radiusMobile : felt.radiusDesktop;
  const stops = isMobile ? felt.gradientStopsMobile : felt.gradientStopsDesktop;
  const positions = isMobile ? felt.gradientPositionsMobile : felt.gradientPositionsDesktop;
  const spotlight = isMobile ? feltLayers.spotlightMobile : feltLayers.spotlightDesktop;
  const innerShadows = isMobile ? feltLayers.innerShadowsMobile : feltLayers.innerShadowsDesktop;

  return (
    <View
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        {
          borderRadius: r,
          borderWidth: felt.borderWidth,
          borderColor: felt.borderColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Elliptical radial felt gradient — svg stretched via preserveAspectRatio */}
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          {/* CSS: radial-gradient(ellipse at 50% 40%, …) → rx 50u, ry 60u */}
          <RadialGradient
            id="sbFeltGradient"
            cx={50}
            cy={40}
            r={50}
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(0, -8) scale(1, 1.2)"
          >
            {stops.map((stop, i) => (
              <Stop key={`${stop}-${positions[i]}`} offset={positions[i]} stopColor={stop} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width={100} height={100} fill="url(#sbFeltGradient)" />
      </Svg>

      {/* Fractal noise texture (felt-noise.png, tileable) */}
      <Image
        source={FELT_NOISE}
        pointerEvents="none"
        resizeMode="stretch"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          opacity: felt.noiseOpacity,
        }}
      />

      {/* Emerald spotlight */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <RadialGradient
            id="sbFeltSpotlight"
            cx={spotlight.cx}
            cy={spotlight.cy}
            r={spotlight.r}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={spotlight.color} stopOpacity={spotlight.opacity} />
            <Stop offset="1" stopColor={spotlight.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={100} height={100} fill="url(#sbFeltSpotlight)" />
      </Svg>

      {/* inset box-shadow layers */}
      {innerShadows.map((s) => (
        <InsetRing
          key={`felt-shadow-${s.depth}`}
          radius={r}
          depth={s.depth}
          color={`rgba(0,0,0,${s.alpha})`}
        />
      ))}

      {children}
    </View>
  );
}
