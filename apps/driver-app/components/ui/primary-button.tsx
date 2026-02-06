import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { palette } from '@/lib/theme';

type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'ghost';
};

export function PrimaryButton({ title, onPress, style, variant = 'primary' }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.base, variant === 'primary' ? styles.primary : styles.ghost, style]}>
      <Text style={[styles.text, variant === 'primary' ? styles.textPrimary : styles.textGhost]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: palette.red,
  },
  ghost: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
  },
  text: {
    fontWeight: '700',
  },
  textPrimary: {
    color: '#fff',
  },
  textGhost: {
    color: palette.redDark,
  },
});
