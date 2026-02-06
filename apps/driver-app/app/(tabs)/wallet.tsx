import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type WalletData = Awaited<ReturnType<typeof mockApi.getWalletSummary>>;

export default function WalletScreen() {
  const [data, setData] = useState<WalletData | null>(null);

  useEffect(() => {
    mockApi.getWalletSummary().then(setData);
  }, []);

  const breakdown = useMemo(
    () => [
      { label: 'Thưởng', value: 120000 },
      { label: 'Khuyến mãi', value: 64000 },
      { label: 'Phí nền tảng', value: -54000 },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Ví & Thu nhập</Text>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillText}>Ví tài xế</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>
            {data ? `${data.summary.balance.toLocaleString('vi-VN')} đ` : '--'}
          </Text>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.smallLabel}>Chờ đối soát</Text>
              <Text style={styles.smallValue}>
                {data ? `${data.summary.pending.toLocaleString('vi-VN')} đ` : '--'}
              </Text>
            </View>
            <View>
              <Text style={styles.smallLabel}>Hôm nay</Text>
              <Text style={styles.smallValue}>
                {data ? `${data.summary.today.toLocaleString('vi-VN')} đ` : '--'}
              </Text>
            </View>
          </View>
          <Text style={styles.payoutText}>
            Kỳ chuyển tiền tiếp theo: {data?.summary.payoutDate ?? '--'}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.lightButton}>
              <Text style={styles.lightButtonText}>Rút tiền</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.lightButton}>
              <Text style={styles.lightButtonText}>Lịch sử</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Phân bổ thu nhập</Text>
          {breakdown.map((item) => (
            <View key={item.label} style={styles.breakRow}>
              <Text style={styles.breakLabel}>{item.label}</Text>
              <Text style={[styles.breakValue, item.value < 0 && styles.breakNegative]}>
                {item.value < 0 ? '-' : ''}{Math.abs(item.value).toLocaleString('vi-VN')} đ
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lịch sử chuyển tiền</Text>
          {data?.payouts.map((item) => (
            <View key={item.id} style={styles.payoutRow}>
              <View>
                <Text style={styles.payoutDate}>{item.date}</Text>
                <Text style={styles.payoutStatus}>{item.status}</Text>
              </View>
              <Text style={styles.payoutAmount}>{item.amount.toLocaleString('vi-VN')} đ</Text>
            </View>
          ))}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  balanceCard: {
    backgroundColor: palette.red,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#FFE7DE',
    fontSize: 12,
  },
  balancePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  balancePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginVertical: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  smallLabel: {
    color: '#FFE7DE',
    fontSize: 12,
  },
  smallValue: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  payoutText: {
    color: '#FFE7DE',
    marginTop: 12,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  lightButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  lightButtonText: {
    color: palette.redDark,
    fontWeight: '700',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sectionTitle: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12,
  },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakLabel: {
    color: palette.muted,
  },
  breakValue: {
    color: palette.text,
    fontWeight: '600',
  },
  breakNegative: {
    color: palette.redDark,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  payoutDate: {
    color: palette.text,
    fontWeight: '600',
  },
  payoutStatus: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  payoutAmount: {
    color: palette.redDark,
    fontWeight: '700',
  },
});
