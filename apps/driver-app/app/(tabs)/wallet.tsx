import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEarnings } from '@/hooks/use-earnings';
import { palette } from '@/lib/theme';

export default function WalletScreen() {
  const { payments, summary, loading, error } = useEarnings({ limit: 20 });

  const breakdown = useMemo(
    () => [
      {
        label: 'Đã thanh toán',
        value: payments
          .filter((item) => item.status?.toUpperCase() === 'PAID')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      },
      {
        label: 'Chờ xử lý',
        value: payments
          .filter((item) => item.status?.toUpperCase() !== 'PAID')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      },
    ],
    [payments],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Ví & Thu nhập</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {loading && payments.length === 0 ? (
          <Text style={styles.emptyText}>Đang tải thu nhập...</Text>
        ) : null}

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillText}>Ví tài xế</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>{summary.total.toLocaleString('vi-VN')} đ</Text>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.smallLabel}>Chờ đối soát</Text>
              <Text style={styles.smallValue}>{summary.pending.toLocaleString('vi-VN')} đ</Text>
            </View>
            <View>
              <Text style={styles.smallLabel}>Hôm nay</Text>
              <Text style={styles.smallValue}>{summary.today.toLocaleString('vi-VN')} đ</Text>
            </View>
          </View>
          <Text style={styles.payoutText}>Kỳ chuyển tiền tiếp theo: --</Text>
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
              <Text style={styles.breakValue}>{item.value.toLocaleString('vi-VN')} đ</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có giao dịch</Text>
          ) : (
            payments.map((item) => (
              <View key={item.id} style={styles.payoutRow}>
                <View>
                  <Text style={styles.payoutDate}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '--'}
                  </Text>
                  <Text style={styles.payoutStatus}>{item.status}</Text>
                </View>
                <Text style={styles.payoutAmount}>{Number(item.amount || 0).toLocaleString('vi-VN')} đ</Text>
              </View>
            ))
          )}
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
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  payoutDate: {
    color: palette.text,
    fontWeight: '600',
  },
  payoutStatus: {
    color: palette.muted,
    fontSize: 12,
  },
  payoutAmount: {
    color: palette.redDark,
    fontWeight: '700',
  },
  emptyText: {
    color: palette.muted,
  },
});
