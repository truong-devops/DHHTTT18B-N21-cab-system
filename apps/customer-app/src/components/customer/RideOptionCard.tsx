import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RideOption } from '../../mock/data';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

type Props = {
  option: RideOption;
  selected?: boolean;
  onPress?: () => void;
};

export const RideOptionCard: React.FC<Props> = ({ option, selected, onPress }) => {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected ? styles.selected : null]}>
      <View style={styles.row}>
        <Text style={styles.name}>{option.name}</Text>
        <Text style={styles.price}>{formatVnd(option.price)}</Text>
      </View>
      <Text style={styles.meta}>
        Đến nơi dự kiến {option.etaMinutes} phút | {option.capacity} chỗ
      </Text>
      {option.surgeLabel ? <Text style={styles.surge}>{option.surgeLabel}</Text> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs
  },
  selected: {
    borderColor: colors.brand600,
    backgroundColor: '#FFF4F1'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  name: {
    ...typography.h2,
    color: colors.text
  },
  price: {
    ...typography.h2,
    color: colors.brand700
  },
  meta: {
    ...typography.body,
    color: colors.muted
  },
  surge: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600'
  }
});
