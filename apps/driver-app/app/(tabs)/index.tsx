import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import { useDriverOnline } from '@/hooks/use-driver-online';
import * as paymentApi from '@/lib/services/payment';
import * as rideApi from '@/lib/services/ride';
import { palette } from '@/lib/theme';

type DashboardData = {
  earningsToday?: number;
  tripsToday?: number;
  onlineTime?: string;
  rating?: string;
  nextGoal?: string;
  acceptanceRate?: number;
  cancelRate?: number;
  hotZone?: string;
  boost?: string;
};

export default function DashboardScreen() {
  const { isAuthenticated } = useAuth();
  const { driver, error: driverError } = useDriver();
  const {
    isOnline,
    state: onlineState,
    error: onlineError,
    sending: onlineSending,
    startOnline,
    stopOnline,
  } = useDriverOnline();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setData(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([paymentApi.listPayments(20), rideApi.listHistory(20)])
      .then(([payments, rides]) => {
        if (!mounted) return;
        const totalAmount = (payments.data || []).reduce((sum, item) => {
          const amount = Number(item.amount || 0);
          return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const trips = (rides.data || []).length;
        setData({
          earningsToday: totalAmount,
          tripsToday: trips,
        });
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? 'Không thể tải dữ liệu');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const initials = useMemo(() => {
    if (!driver?.fullName) return 'TX';
    const parts = driver.fullName.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }, [driver?.fullName]);

  const onlineLabel =
    onlineState === 'sending' ? 'ĐANG CẬP NHẬT' : isOnline ? 'ĐANG BẬT' : 'NGOẠI TUYẾN';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {driverError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{driverError}</Text>
          </View>
        ) : null}
        {/* {onlineError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{onlineError}</Text>
          </View>
        ) : null} */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onLongPress={() => router.push('/debug')}
            delayLongPress={600}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Chào mừng trở lại</Text>
            <Text style={styles.name}>{driver?.fullName ?? '--'}</Text>
            <View style={styles.headerMeta}>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingValue}>{data?.rating ?? '--'}</Text>
                <Text style={styles.ratingLabel}>đánh giá</Text>
              </View>
              <Text style={styles.vehicle}>{driver?.vehicle?.plateNumber ?? '--'}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              onlineState === 'sending'
                ? styles.statusPending
                : isOnline
                  ? styles.statusOnline
                  : styles.statusOffline,
            ]}>
            <Text style={[styles.statusText, isOnline ? styles.statusOnlineText : styles.statusOfflineText]}>
              {onlineLabel}
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Doanh thu hôm nay</Text>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>Ca sáng</Text>
            </View>
          </View>
          <Text style={styles.heroValue}>
            {data?.earningsToday !== undefined ? `${data.earningsToday.toLocaleString('vi-VN')} đ` : '--'}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Chuyến</Text>
              <Text style={styles.heroStatValue}>{data?.tripsToday ?? '--'}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Online</Text>
              <Text style={styles.heroStatValue}>{data?.onlineTime ?? '--'}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Đánh giá</Text>
              <Text style={styles.heroStatValue}>{data?.rating ?? '--'}</Text>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroHint}>{data?.nextGoal ?? 'Mục tiêu thưởng đang cập nhật.'}</Text>
            <TouchableOpacity style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Xem chi tiết</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hiệu suất</Text>
            <Text style={styles.sectionSub}>Tỷ lệ trong ngày</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Nhận chuyến</Text>
              <Text style={styles.statValue}>{data?.acceptanceRate ?? '--'}%</Text>
              <Text style={styles.statHint}>Mục tiêu 90%</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Hủy chuyến</Text>
              <Text style={styles.statValue}>{data?.cancelRate ?? '--'}%</Text>
              <Text style={styles.statHint}>Dưới 5%</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vùng nóng & Boost</Text>
            <Text style={styles.sectionSub}>Ưu tiên khu vực đông khách</Text>
          </View>
          <View style={styles.hotRow}>
            <View style={styles.hotBox}>
              <Text style={styles.hotLabel}>Khu vực</Text>
              <Text style={styles.hotValue}>{data?.hotZone ?? '--'}</Text>
            </View>
            <View style={styles.hotBox}>
              <Text style={styles.hotLabel}>Boost</Text>
              <Text style={styles.hotValue}>{data?.boost ?? '--'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gợi ý vận hành</Text>
            <Text style={styles.sectionSub}>Tối ưu thu nhập</Text>
          </View>
          <Text style={styles.bodyText}>
            Tập trung các tuyến trung tâm, ưu tiên đón khách tại tòa nhà văn phòng để tăng
            số chuyến và thời gian chờ thấp.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.ghostButton}>
              <Text style={styles.ghostText}>Báo cáo nhanh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={onlineSending}
              onPress={async () => {
                if (!isAuthenticated) {
                  Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để nhận chuyến.');
                  return;
                }
                try {
                  if (isOnline) {
                    await stopOnline();
                  } else {
                    await startOnline();
                  }
                } catch (err: any) {
                  Alert.alert('Không thể cập nhật trạng thái', err?.message ?? 'Đã có lỗi xảy ra');
                }
              }}>
              <Text style={styles.primaryText}>
                {onlineSending ? 'Đang cập nhật...' : isOnline ? 'Tắt nhận chuyến' : 'Bật nhận chuyến'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  errorCard: {
    backgroundColor: '#FFF1F1',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: palette.redSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  avatarText: {
    fontWeight: '700',
    color: palette.redDark,
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
  },
  greeting: {
    color: palette.muted,
    fontSize: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginTop: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.redSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingValue: {
    fontWeight: '700',
    color: palette.redDark,
    fontSize: 12,
  },
  ratingLabel: {
    color: palette.redDark,
    fontSize: 11,
  },
  vehicle: {
    color: palette.muted,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusOnline: {
    backgroundColor: palette.redSoft,
  },
  statusOffline: {
    backgroundColor: '#F5F5F5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusOnlineText: {
    color: palette.redDark,
  },
  statusOfflineText: {
    color: palette.muted,
  },
  heroCard: {
    backgroundColor: palette.red,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    top: -80,
    right: -60,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#FFE7DE',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  heroValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 10,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    color: '#FFE7DE',
    fontSize: 12,
  },
  heroStatValue: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 4,
  },
  heroFooter: {
    marginTop: 16,
    gap: 10,
  },
  heroHint: {
    color: '#FFE7DE',
    fontSize: 12,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroButtonText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  sectionSub: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: palette.redSoft,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  statValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  statHint: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 6,
  },
  hotRow: {
    flexDirection: 'row',
    gap: 12,
  },
  hotBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#fff',
  },
  hotLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  hotValue: {
    color: palette.text,
    fontWeight: '600',
    marginTop: 6,
  },
  bodyText: {
    color: palette.text,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  ghostButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  ghostText: {
    color: palette.redDark,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.red,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
