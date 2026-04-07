import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCustomerStore } from '../../store/customerStore';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

const accent = '#FFF4F1';

const WalletScreen = () => {
  const { walletBalance } = useCustomerStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ví của bạn</Text>
      <Card style={[styles.balanceCard, { backgroundColor: accent }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>Số dư khả dụng</Text>
            <Text style={styles.amount}>{formatVnd(walletBalance)}</Text>
          </View>
          <Text style={styles.walletIcon}>👛</Text>
        </View>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton title="Nạp tiền" onPress={() => {}} />
        <PrimaryButton title="Liên kết thẻ" onPress={() => {}} />
      </View>
      <Card style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Phương thức thanh toán</Text>
        <Text style={styles.desc}>Tiền mặt, Thẻ/Ví, VietQR</Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  balanceCard: {},
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.body, color: colors.muted },
  amount: { ...typography.title, color: colors.brand700 },
  walletIcon: { fontSize: 32 },
  actions: { flexDirection: 'row', gap: spacing.md },
  desc: { ...typography.body, color: colors.text }
});

export default WalletScreen;
