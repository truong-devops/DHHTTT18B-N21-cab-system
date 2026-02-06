import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type DashboardData = Awaited<ReturnType<typeof mockApi.getDashboard>>;
type DriverProfile = Awaited<ReturnType<typeof mockApi.getDriverProfile>>;

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);

  useEffect(() => {
    Promise.all([mockApi.getDashboard(), mockApi.getDriverProfile()]).then(([dashboard, driver]) => {
      setData(dashboard);
      setProfile(driver);
    });
  }, []);

  const initials = useMemo(() => {
    if (!profile?.name) return 'TX';
    const parts = profile.name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }, [profile?.name]);

  const onlineLabel = profile?.online ? 'ĐANG BẬT' : 'NGOẠI TUYẾN';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Chào mừng trở lại</Text>
            <Text style={styles.name}>{profile?.name ?? '--'}</Text>
            <View style={styles.headerMeta}>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingValue}>{profile?.rating ?? '--'}</Text>
                <Text style={styles.ratingLabel}>đánh giá</Text>
              </View>
              <Text style={styles.vehicle}>{profile?.vehicle ?? '--'}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, profile?.online ? styles.statusOnline : styles.statusOffline]}>
            <Text style={[styles.statusText, profile?.online ? styles.statusOnlineText : styles.statusOfflineText]}>
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
            {data ? `${data.earningsToday.toLocaleString('vi-VN')} đ` : '--'}
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
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryText}>Bật nhận chuyến</Text>
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
