import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { IconSymbol } from '../ui/icon-symbol';
import { useAppPalette } from '../../theme/palette';

type Props = {
  value?: string;
  placeholder?: string;
  onPress: () => void;
};

export const LocationSearch: React.FC<Props> = ({ value, placeholder = 'Bạn muốn đi đến đâu?', onPress }) => {
  const palette = useAppPalette();

  return (
    <Pressable
      style={[styles.container, { borderColor: palette.border, backgroundColor: palette.surface }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Chọn điểm đến"
    >
      <View style={styles.left}>
        <IconSymbol name="location.fill" size={18} color={colors.brand700} />
        <Text style={[styles.value, { color: palette.text }]} numberOfLines={1}>
          {value?.trim() ? value : placeholder}
        </Text>
      </View>
      <Text style={styles.action}>Chọn</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  value: {
    ...typography.body,
    flex: 1
  },
  action: {
    ...typography.caption,
    color: colors.brand700,
    fontWeight: '700'
  }
});
