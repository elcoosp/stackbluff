import type { ReactElement } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses `#rgb`, `#rrggbb`, `rgb()` and `rgba()` into RGBA floats. */
export function parseColor(input: string): RgbaColor {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(input.trim());
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: Number.parseInt(h[0] + h[0], 16),
        g: Number.parseInt(h[1] + h[1], 16),
        b: Number.parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)$/i.exec(
    input.trim(),
  );
  if (rgba) {
    const aRaw = rgba[4];
    let a = 1;
    if (aRaw != null) {
      a = aRaw.endsWith('%') ? Number.parseFloat(aRaw) / 100 : Number.parseFloat(aRaw);
    }
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export interface InsetRingProps {
  /** Corner radius of the ring (match the parent view). */
  radius: number;
  /** How far (px) the inset shadow bleeds inward from each edge. */
  depth?: number;
  /** Ring color including alpha, e.g. `'rgba(0,0,0,0.45)'`. */
  color?: string;
  /** Number of stacked rings used for the fade (more = smoother). */
  layers?: number;
  /** Render as an absolute fill over the parent (default true). */
  absolute?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Emulates a CSS `inset 0 0 <depth>px <color>` box-shadow with nested
 * bordered Views: N concentric translucent rings stacked on top of each
 * other produce a darkest-at-the-edge fade — the same trick browsers use to
 * fake feathering without blur support in RN.
 *
 * Typical use (felt inner shadow):
 * ```tsx
 * <View style={{borderRadius: 28, overflow: 'hidden'}}>
 *   <InsetRing radius={28} depth={20} color="rgba(0,0,0,0.45)" />
 *   {content}
 * </View>
 * ```
 */
export function InsetRing({
  radius,
  depth = 12,
  color = 'rgba(0,0,0,0.9)',
  layers = 4,
  absolute = true,
  style,
}: InsetRingProps) {
  if (depth <= 0 || layers <= 0) return null;

  const { r, g, b, a } = parseColor(color);
  const ringViews: ReactElement[] = [];
  for (let k = 1; k <= layers; k++) {
    const width = Math.max(1, Math.round((depth * k) / layers));
    ringViews.push(
      <View
        pointerEvents="none"
        key={`ring-${k}-${width}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: radius,
          borderWidth: width,
          borderColor: `rgba(${r},${g},${b},${(a / layers).toFixed(4)})`,
        }}
      />,
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        absolute
          ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
          : { width: '100%', height: '100%' },
        style,
      ]}
    >
      {ringViews}
    </View>
  );
}
