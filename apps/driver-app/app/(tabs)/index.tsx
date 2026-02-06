import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type DashboardData = Awaited<ReturnType<typeof mockApi.getDashboard>>;

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    mockApi.getDashboard().then(setData);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tổng quan</Text>
            <Text style={styles.subtitle}>Chào mừng trở lại, tài xế!</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Đang trực tuyến</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hôm nay</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Thu nhập</Text>
              <Text style={styles.kpiValue}>
                {data ? `${data.earningsToday.toLocaleString('vi-VN')} đ` : '--'}
              </Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Số chuyến</Text>
              <Text style={styles.kpiValue}>{data?.tripsToday ?? '--'}</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Đánh giá</Text>
              <Text style={styles.kpiValue}>{data?.rating ?? '--'}</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Online</Text>
              <Text style={styles.kpiValue}>{data?.onlineTime ?? '--'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông báo nóng</Text>
          <View style={styles.highlightRow}>
            <View style={styles.highlightBox}>
              <Text style={styles.highlightLabel}>Khu vực nóng</Text>
              <Text style={styles.highlightValue}>{data?.hotZone ?? '--'}</Text>
            </View>
            <View style={styles.highlightBox}>
              <Text style={styles.highlightLabel}>Boost</Text>
              <Text style={styles.highlightValue}>{data?.boost ?? '--'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gợi ý</Text>
          <Text style={styles.bodyText}>
            Hãy tập trung tại các tuyến trung tâm để tối ưu số chuyến và tăng thu nhập.
          </Text>
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
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    color: palette.muted,
    marginTop: 4,
  },
  badge: {
    backgroundColor: palette.redSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  badgeText: {
    color: palette.redDark,
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiItem: {
    flex: 1,
    backgroundColor: palette.redSoft,
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  kpiValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  highlightBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  highlightLabel: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  highlightValue: {
    color: palette.text,
    fontWeight: '600',
  },
  bodyText: {
    color: palette.text,
    lineHeight: 20,
  },
});
