import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { IconSymbol } from '../ui/icon-symbol';

type Props = {
  value?: string;
  placeholder?: string;
  onPress: () => void;
};

export const LocationSearch: React.FC<Props> = ({ value, placeholder = 'Ban muon di den dau?', onPress }) => {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.left}>
        <IconSymbol name="location.fill" size={18} color={colors.brand700} />
        <Text style={styles.value} numberOfLines={1}>
          {value?.trim() ? value : placeholder}
        </Text>
      </View>
      <Text style={styles.action}>Set</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
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
    color: colors.text,
    flex: 1
  },
  action: {
    ...typography.caption,
    color: colors.brand700,
    fontWeight: '700'
  }
});
