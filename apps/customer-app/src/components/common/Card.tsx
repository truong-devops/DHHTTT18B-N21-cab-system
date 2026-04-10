import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export const Card: React.FC<Props> = ({ children, style, onPress }) => {
  const palette = useAppPalette();

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border
          },
          pressed ? styles.pressed : null,
          style
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border
        },
        style
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md
  },
  pressed: {
    opacity: 0.88
  }
});
