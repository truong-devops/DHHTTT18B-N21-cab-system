import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RideHistoryItem } from '../../mock/data';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

export const RideHistoryCard: React.FC<{ item: RideHistoryItem }> = ({ item }) => {
  const statusLabel = item.status === 'completed' ? 'Hoàn thành' : 'Đã hủy';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.date}>{item.date}</Text>
        <Text style={styles.amount}>{formatVnd(item.amount)}</Text>
      </View>
      <Text style={styles.route}>
        {item.pickup}
        {' -> '}
        {item.destination}
      </Text>
      <Text style={[styles.status, item.status === 'completed' ? styles.done : styles.cancel]}>{statusLabel}</Text>
    </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { ...typography.caption, color: colors.muted },
  amount: { ...typography.body, color: colors.text, fontWeight: '600' },
  route: { ...typography.body, color: colors.text },
  status: { ...typography.caption, textTransform: 'uppercase' },
  done: { color: colors.success },
  cancel: { color: colors.danger }
});
