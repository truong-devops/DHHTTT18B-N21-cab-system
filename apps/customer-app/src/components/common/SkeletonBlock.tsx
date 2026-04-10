import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { radius } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  height?: number;
  width?: number | `${number}%` | 'auto';
  style?: StyleProp<ViewStyle>;
};

export const SkeletonBlock: React.FC<Props> = ({ height = 16, width = '100%', style }) => {
  const colors = useAppPalette();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          height,
          width,
          opacity,
          backgroundColor: colors.surface2
        },
        style
      ]}
    />
  );
};

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.input
  }
});
