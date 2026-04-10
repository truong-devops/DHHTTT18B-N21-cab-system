import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { spacing } from '../theme/tokens';

export function useScreenMetrics() {
  const { width, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const horizontalPadding = width >= 1080 ? spacing.xxl : width >= 768 ? spacing.xl : spacing.lg;
    const contentMaxWidth = width >= 1080 ? 860 : width >= 768 ? 720 : width;
    const isCompact = width < 360;
    const isTabletLike = width >= 768;
    const adjustedFontScale = Math.min(Math.max(fontScale, 1), 1.25);

    return {
      width,
      horizontalPadding,
      contentMaxWidth,
      isCompact,
      isTabletLike,
      adjustedFontScale
    };
  }, [fontScale, width]);
}
