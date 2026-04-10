import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/common/Card';
import { useCustomerStore } from '../../store/customerStore';
import { colors, spacing, typography } from '../../theme/tokens';
import type { RideHistoryItem } from '../../mock/data';
import { IconSymbol } from '../../components/ui/icon-symbol';

const pickupDot = '#1AA3FF';
const dropoffDot = '#FF7A00';
const cardA = '#FFF4F1';
const cardB = '#F4F7FF';

type StatusFilter = 'all' | 'completed' | 'cancelled';
type DateFilter = 'all' | '7d' | '30d' | '90d';
type SelectTarget = 'status' | 'date' | null;

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Tat ca', value: 'all' },
  { label: 'Hoan thanh', value: 'completed' },
  { label: 'Huy', value: 'cancelled' }
];

const dateOptions: Array<{ label: string; value: DateFilter }> = [
  { label: 'Tat ca', value: 'all' },
  { label: '7 ngay', value: '7d' },
  { label: '30 ngay', value: '30d' },
  { label: '90 ngay', value: '90d' }
];

function monthLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Khac';
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `Thang ${month}/${d.getFullYear()}`;
}

function paymentMethodLabel(value: string | null | undefined) {
  const method = String(value || '').toUpperCase();
  if (method === 'CASH') return 'Cash';
  if (method === 'WALLET') return 'Wallet';
  if (method === 'VIETQR') return 'VietQR';
  if (method === 'CARD') return 'Card';
  return 'Khong co du lieu';
}

function paymentStatusLabel(value: string | null | undefined) {
  const status = String(value || '').toUpperCase();
  if (!status) return 'Khong co du lieu';
  if (status === 'SUCCESS' || status === 'SUCCEEDED') return 'Thanh cong';
  if (status === 'FAILED') return 'That bai';
  if (status === 'PENDING') return 'Dang xu ly';
  if (status === 'TIMEOUT') return 'Het thoi gian';
  return status;
}

function formatVnd(value: number | null | undefined) {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(amount).toLocaleString('vi-VN')}d`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Khong co du lieu';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function isInDateRange(item: RideHistoryItem, filter: DateFilter) {
  if (filter === 'all') return true;
  const ts = Date.parse(item.rideCreatedAt || item.date);
  if (!Number.isFinite(ts)) return false;
  const days = Number(filter.replace('d', ''));
  const maxDiffMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - ts <= maxDiffMs;
}

function groupByMonth(items: RideHistoryItem[]) {
  return items.reduce<Record<string, RideHistoryItem[]>>((acc, item) => {
    const label = monthLabel(item.rideCreatedAt || item.date);
    acc[label] = acc[label] || [];
    acc[label].push(item);
    return acc;
  }, {});
}

const HistoryScreen = () => {
  const { history, loadHistory } = useCustomerStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedRide, setSelectedRide] = useState<RideHistoryItem | null>(null);
  const [selectTarget, setSelectTarget] = useState<SelectTarget>(null);

  useEffect(() => {
    loadHistory().catch(() => {
      // ignore history fetch errors in UI
    });
  }, [loadHistory]);

  const displayHistory = useMemo(() => {
    const base = [...history].sort((a, b) => Date.parse(b.rideCreatedAt || b.date) - Date.parse(a.rideCreatedAt || a.date));
    return base.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return isInDateRange(item, dateFilter);
    });
  }, [dateFilter, history, statusFilter]);

  const grouped = useMemo(() => groupByMonth(displayHistory), [displayHistory]);

  const statusLabel = statusOptions.find((item) => item.value === statusFilter)?.label || 'Tat ca';
  const dateLabel = dateOptions.find((item) => item.value === dateFilter)?.label || 'Tat ca';

  const renderSelect = (label: string, value: string, onPress: () => void) => (
    <View style={styles.selectGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.selectTrigger}>
        <Text style={styles.selectValue}>{value}</Text>
        <Text style={styles.selectCaret}>v</Text>
      </Pressable>
    </View>
  );

  const renderItem = (item: RideHistoryItem, index: number) => (
    <Pressable key={item.id} onPress={() => setSelectedRide(item)}>
      <Card style={[styles.itemCard, { backgroundColor: index % 2 === 0 ? cardA : cardB }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.time}>{formatDateTime(item.rideCreatedAt || item.date)}</Text>
          <View style={[styles.statusChip, item.status === 'completed' ? styles.statusSuccess : styles.statusCancel]}>
            <Text style={[styles.statusText, item.status === 'completed' ? styles.statusTextSuccess : styles.statusTextCancel]}>
              {item.status === 'completed' ? 'Hoan thanh' : 'Huy'}
            </Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.vehicleBadge}>
            <IconSymbol name="car.fill" size={18} color={colors.brand700} />
          </View>
          <View style={styles.routeContent}>
            <View style={styles.pointRow}>
              <IconSymbol name="pin.fill" size={10} color={pickupDot} />
              <Text style={styles.place} numberOfLines={1}>
                {item.pickup}
              </Text>
            </View>
            <View style={styles.pointRow}>
              <IconSymbol name="pin.fill" size={10} color={dropoffDot} />
              <Text style={styles.place} numberOfLines={1}>
                {item.destination}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.price}>{formatVnd(item.amount)}</Text>
          <Text style={styles.tapHint}>Nhan vao de xem chi tiet</Text>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Lich su chuyen di</Text>
          <View style={styles.filtersBlock}>
            <View style={styles.filterInlineRow}>
              {renderSelect('Status', statusLabel, () => setSelectTarget('status'))}
              {renderSelect('Date', dateLabel, () => setSelectTarget('date'))}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {displayHistory.length === 0 ? <Text style={styles.emptyText}>Khong co chuyen di phu hop bo loc.</Text> : null}
          {Object.entries(grouped).map(([label, items]) => (
            <View key={label} style={styles.monthBlock}>
              <Text style={styles.month}>{label}</Text>
              {items.map((it, idx) => renderItem(it, idx))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedRide)} transparent animationType="slide" onRequestClose={() => setSelectedRide(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiet chuyen di</Text>
              <Pressable onPress={() => setSelectedRide(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Dong</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedRide ? (
                <View style={styles.detailSectionWrap}>
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Tong quan</Text>
                    <Text style={styles.detailLine}>Ride ID: {selectedRide.id}</Text>
                    <Text style={styles.detailLine}>External Ride ID: {selectedRide.externalRideId || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Booking ID: {selectedRide.bookingId || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Rider ID: {selectedRide.riderId || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Trang thai: {selectedRide.rideStatusRaw || selectedRide.status}</Text>
                    <Text style={styles.detailLine}>Status update: {formatDateTime(selectedRide.rideStatusUpdatedAt)}</Text>
                    <Text style={styles.detailLine}>Ngay tao: {formatDateTime(selectedRide.rideCreatedAt || selectedRide.date)}</Text>
                    <Text style={styles.detailLine}>Cap nhat: {formatDateTime(selectedRide.rideUpdatedAt)}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Lo trinh</Text>
                    <Text style={styles.detailLine}>Diem don: {selectedRide.pickup}</Text>
                    <Text style={styles.detailLine}>Diem den: {selectedRide.destination}</Text>
                    <Text style={styles.detailLine}>
                      Toa do don: {selectedRide.pickupLat ?? '-'}, {selectedRide.pickupLng ?? '-'}
                    </Text>
                    <Text style={styles.detailLine}>
                      Toa do den: {selectedRide.dropoffLat ?? '-'}, {selectedRide.dropoffLng ?? '-'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Tai xe</Text>
                    <Text style={styles.detailLine}>Driver ID: {selectedRide.driverId || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Ten tai xe: {selectedRide.driverName || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>So dien thoai: {selectedRide.driverPhone || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Loai xe: {selectedRide.vehicleType || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Bien so: {selectedRide.plateNumber || 'Khong co du lieu'}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Thanh toan</Text>
                    <Text style={styles.detailLine}>Payment ID: {selectedRide.paymentId || 'Khong co du lieu'}</Text>
                    <Text style={styles.detailLine}>Phuong thuc: {paymentMethodLabel(selectedRide.paymentMethod)}</Text>
                    <Text style={styles.detailLine}>Trang thai: {paymentStatusLabel(selectedRide.paymentStatus)}</Text>
                    <Text style={styles.detailLine}>
                      So tien: {formatVnd(selectedRide.paymentAmount)} {selectedRide.paymentCurrency || ''}
                    </Text>
                    <Text style={styles.detailLine}>Ngay tao: {formatDateTime(selectedRide.paymentCreatedAt)}</Text>
                    <Text style={styles.detailLine}>Ngay cap nhat: {formatDateTime(selectedRide.paymentUpdatedAt)}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Tong tien chuyen di</Text>
                    <Text style={styles.totalAmount}>{formatVnd(selectedRide.amount)}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectTarget)} transparent animationType="fade" onRequestClose={() => setSelectTarget(null)}>
        <Pressable style={styles.selectOverlay} onPress={() => setSelectTarget(null)}>
          <Pressable style={styles.selectPanel} onPress={() => {}}>
            <Text style={styles.selectTitle}>{selectTarget === 'status' ? 'Chon trang thai' : 'Chon thoi gian'}</Text>
            {(selectTarget === 'status' ? statusOptions : dateOptions).map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  if (selectTarget === 'status') {
                    setStatusFilter(option.value as StatusFilter);
                  } else {
                    setDateFilter(option.value as DateFilter);
                  }
                  setSelectTarget(null);
                }}
                style={styles.selectOption}
              >
                <Text style={styles.selectOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xl },
  header: {
    backgroundColor: colors.brand600,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  title: { ...typography.h2, color: colors.white, marginBottom: spacing.sm },
  filtersBlock: { gap: spacing.xs },
  filterInlineRow: { flexDirection: 'row', gap: spacing.sm },
  selectGroup: { flex: 1, gap: spacing.xs },
  filterLabel: { ...typography.caption, color: colors.white, fontWeight: '700' },
  selectTrigger: {
    borderRadius: 12,
    borderColor: colors.white,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectValue: { ...typography.body, color: colors.white, fontWeight: '600' },
  selectCaret: { ...typography.caption, color: colors.white, fontWeight: '700' },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  emptyText: { ...typography.body, color: colors.muted, marginTop: spacing.md },
  monthBlock: { marginTop: spacing.lg, gap: spacing.sm },
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
  routeContent: { flex: 1, gap: spacing.xs },
  vehicleBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,90,31,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  place: { ...typography.body, color: colors.text, flex: 1 },
  price: { ...typography.h2, color: colors.brand700 },
  tapHint: { ...typography.caption, color: colors.muted, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'flex-end'
  },
  modalPanel: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: spacing.lg
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { ...typography.h2, color: colors.text },
  closeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  closeBtnText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  modalScroll: { marginTop: spacing.xs },
  detailSectionWrap: { gap: spacing.sm, paddingBottom: spacing.xl },
  detailSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface2
  },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  detailLine: { ...typography.body, color: colors.muted },
  totalAmount: { ...typography.title, color: colors.brand700 },
  selectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl
  },
  selectPanel: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  selectTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs
  },
  selectOption: {
    paddingVertical: spacing.sm
  },
  selectOptionText: { ...typography.body, color: colors.text }
});

export default HistoryScreen;

