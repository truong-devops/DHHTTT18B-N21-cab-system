import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export const OutlineButton: React.FC<Props> = ({ title, onPress, disabled, style, textStyle }) => {
  const palette = useAppPalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface
        },
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style
      ]}
    >
      <Text style={[styles.text, { color: palette.text }, disabled ? { color: palette.muted } : null, textStyle]}>{title}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.86 },
  text: { ...typography.body, fontWeight: '500' }
});
