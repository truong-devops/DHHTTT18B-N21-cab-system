import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  collapsedHeight?: number;
  children: React.ReactNode;
};

export const BottomSheet: React.FC<Props> = ({ collapsedHeight = 140, children }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = useAppPalette();
  const caretAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    Animated.timing(caretAnim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start();
  }, [caretAnim, expanded]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const rotate = caretAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowOpacity: expanded ? 0.22 : 0.15,
          height: expanded ? undefined : collapsedHeight
        },
        expanded ? styles.expanded : null
      ]}
    >
      <Pressable
        onPress={toggle}
        style={styles.dragWrap}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Thu gọn bảng thông tin' : 'Mở rộng bảng thông tin'}
      >
        <View style={[styles.drag, { backgroundColor: colors.border }]} />
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Text style={[styles.caret, { color: colors.muted }]}>⌃</Text>
        </Animated.View>
      </Pressable>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  expanded: {
    top: Platform.select({ ios: spacing.xl, android: spacing.xl, default: spacing.xl })
  },
  dragWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xs,
    gap: 2
  },
  drag: {
    width: 60,
    height: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: spacing.xs
  },
  caret: {
    ...typography.caption,
    fontWeight: '700'
  }
});
