import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
};

export const PrimaryButton: React.FC<Props> = ({ title, onPress, disabled }) => {
  const palette = useAppPalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.brand600 },
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.9
  },
  text: {
    ...typography.body,
    color: '#FFF',
    fontWeight: '600'
  }
});
