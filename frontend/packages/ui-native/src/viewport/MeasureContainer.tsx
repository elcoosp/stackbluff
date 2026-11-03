import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';

export interface ContainerSize {
  width: number;
  height: number;
}

const MeasureContext = createContext<ContainerSize>({ width: 0, height: 0 });

export interface MeasureContainerProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fired once per measured size change (layout callback — not per frame). */
  onMeasure?: (size: ContainerSize) => void;
}

/**
 * Measures its own box via `onLayout` and exposes the size through context.
 * This is the React Native equivalent of CSS container queries
 * (`container-type: inline-size` + `cqw` units) used by the PWA card styles.
 *
 * Consume with {@link useContainerWidth} / {@link useContainerSize}.
 */
export function MeasureContainer({ children, style, onMeasure }: MeasureContainerProps) {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setSize((prev) => {
        if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
          return prev;
        }
        onMeasure?.({ width, height });
        return { width, height };
      });
    },
    [onMeasure],
  );

  const value = useMemo(() => size, [size]);

  return (
    <MeasureContext.Provider value={value}>
      <View onLayout={handleLayout} style={style}>
        {children}
      </View>
    </MeasureContext.Provider>
  );
}

/** Current {@link MeasureContainer} size. Returns `{0, 0}` before first layout. */
export function useContainerSize(): ContainerSize {
  return useContext(MeasureContext);
}

/** Current {@link MeasureContainer} width in px. Returns 0 before first layout. */
export function useContainerWidth(): number {
  return useContext(MeasureContext).width;
}
