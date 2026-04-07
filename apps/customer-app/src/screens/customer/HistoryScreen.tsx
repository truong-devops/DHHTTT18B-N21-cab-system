import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCustomerStore } from '../../store/customerStore';
import { Card } from '../../components/common/Card';
import { OutlineButton } from '../../components/common/OutlineButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import type { RideHistoryItem } from '../../mock/data';

const pickupDot = '#1AA3FF';
const dropoffDot = '#FF7A00';
const brand = colors.brand600;
const cardA = '#FFF4F1';
const cardB = '#F4F7FF';
function monthLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Khác';
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `Tháng ${month}/${d.getFullYear()}`;
}

function groupByMonth(items: RideHistoryItem[]) {
  return items.reduce<Record<string, RideHistoryItem[]>>((acc, item) => {
    const label = monthLabel(item.date);
    acc[label] = acc[label] || [];
    acc[label].push(item);
    return acc;
  }, {});
}

const HistoryScreen = () => {
  const { history, loadHistory } = useCustomerStore();
  const [activeFilter] = useState<'ride'>('ride');

  useEffect(() => {
    loadHistory().catch(() => {
      // demo: ignore errors
    });
  }, [loadHistory]);

  const displayHistory = history;

  const grouped = useMemo(() => groupByMonth(displayHistory), [displayHistory]);

  const renderItem = (item: RideHistoryItem, index: number) => (
    <Card key={item.id} style={[styles.itemCard, { backgroundColor: index % 2 === 0 ? cardA : cardB }]}>
      <View style={styles.rowBetween}>
        <Text style={styles.time}>{item.date}</Text>
        <View style={[styles.statusChip, item.status === 'completed' ? styles.statusSuccess : styles.statusCancel]}>
          <Text style={[styles.statusText, item.status === 'completed' ? styles.statusTextSuccess : styles.statusTextCancel]}>
            {item.status === 'completed' ? 'Hoàn thành' : 'Hủy'}
          </Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.vehicleBadge}>
          <Text style={styles.vehicleIcon}>🛵</Text>
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={styles.pointRow}>
            <Text style={[styles.dot, { color: pickupDot }]}>●</Text>
            <Text style={styles.place} numberOfLines={1}>
              {item.pickup}
            </Text>
          </View>
          <View style={styles.pointRow}>
            <Text style={[styles.dot, { color: dropoffDot }]}>●</Text>
            <Text style={styles.place} numberOfLines={1}>
              {item.destination}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.price}>{item.amount.toLocaleString('vi-VN')}đ</Text>
        <View style={styles.actionsRow}>
          <Text style={styles.link}>Chi tiết</Text>
          <OutlineButton title="Đặt quay về" onPress={() => {}} style={styles.secondaryBtn} textStyle={styles.secondaryBtnText} />
          <PrimaryButton title="Đặt lại" onPress={() => {}} />
        </View>
      </View>
    </Card>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={styles.header}>
        <Text style={styles.title}>Hoạt động</Text>
        <View style={styles.filterRow}>
          <OutlineButton
            title="Di chuyển"
            onPress={() => {}}
            style={[styles.chip, styles.chipActive]}
            textStyle={[styles.chipText, styles.chipTextActive]}
          />
        </View>
      </View>

      <View style={styles.body}>
        {Object.entries(grouped).map(([label, items]) => (
          <View key={label} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <Text style={styles.month}>{label}</Text>
            {items.map((it, idx) => renderItem(it, idx))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.brand600,
    width: '100%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.white, marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderColor: '#fff',
    borderWidth: 1
  },
  chipText: { ...typography.body, color: '#fff' },
  chipActive: { borderColor: '#fff', backgroundColor: '#ffffff' },
  chipTextActive: { color: colors.brand700 },
  month: { ...typography.body, fontWeight: '700', color: colors.muted, marginTop: spacing.sm },
  itemCard: { gap: spacing.sm, padding: spacing.md, borderRadius: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { ...typography.body, color: colors.muted },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999
  },
  statusSuccess: { backgroundColor: '#E7F7EC' },
  statusCancel: { backgroundColor: '#FEE8E6' },
  statusText: { ...typography.caption, fontWeight: '700' },
  statusTextSuccess: { color: '#1F9254' },
  statusTextCancel: { color: colors.danger },
  routeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  vehicleBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,90,31,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  vehicleIcon: { fontSize: 18 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { fontSize: 14, color: pickupDot },
  place: { ...typography.body, color: colors.text, flex: 1 },
  price: { ...typography.h2, color: brand },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { ...typography.body, color: colors.info },
  secondaryBtn: { height: 38, paddingHorizontal: spacing.md, borderColor: colors.border },
  secondaryBtnText: { color: colors.text }
});

export default HistoryScreen;
