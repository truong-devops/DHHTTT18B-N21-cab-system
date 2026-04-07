import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette } from '@/lib/theme';

type ScreenHeaderProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  variant?: 'red' | 'light';
  style?: StyleProp<ViewStyle>;
}>;

export function ScreenHeader({ title, subtitle, variant = 'light', style, children }: ScreenHeaderProps) {
  const isRed = variant === 'red';

  return (
    <View style={[styles.base, isRed ? styles.red : styles.light, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, isRed && styles.titleOnRed]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isRed && styles.subtitleOnRed]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  red: {
    backgroundColor: palette.red
  },
  light: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border
  },
  textBlock: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text
  },
  subtitle: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 12
  },
  titleOnRed: {
    color: '#fff'
  },
  subtitleOnRed: {
    color: '#FFE7DE'
  }
});
