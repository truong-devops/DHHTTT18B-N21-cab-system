import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type WalletData = Awaited<ReturnType<typeof mockApi.getWalletSummary>>;

export default function WalletScreen() {
  const [data, setData] = useState<WalletData | null>(null);

  useEffect(() => {
    mockApi.getWalletSummary().then(setData);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Ví & Thu nhập</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lịch sử chuyển tiền</Text>
          {data?.payouts.map((item) => (
            <View key={item.id} style={styles.payoutRow}>
              <Text style={styles.payoutDate}>{item.date}</Text>
              <Text style={styles.payoutAmount}>
                {item.amount.toLocaleString('vi-VN')} đ
              </Text>
              <Text style={styles.payoutStatus}>{item.status}</Text>
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
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  balanceCard: {
    backgroundColor: palette.red,
    borderRadius: 20,
    padding: 18,
  },
  balanceLabel: {
    color: '#FFE7E3',
    fontSize: 12,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  smallLabel: {
    color: '#FFE7E3',
    fontSize: 12,
  },
  smallValue: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  payoutText: {
    color: '#FFE7E3',
    marginTop: 12,
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
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  payoutDate: {
    color: palette.muted,
    fontSize: 12,
  },
  payoutAmount: {
    color: palette.text,
    fontWeight: '600',
  },
  payoutStatus: {
    color: palette.redDark,
    fontSize: 12,
    fontWeight: '600',
  },
});
