import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCustomerStore } from '../../store/customerStore';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { IconSymbol } from '../../components/ui/icon-symbol';

const accent = '#FFF4F1';

const WalletScreen = () => {
  const { walletBalance } = useCustomerStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vi cua ban</Text>
      <Card style={[styles.balanceCard, { backgroundColor: accent }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>So du kha dung</Text>
            <Text style={styles.amount}>{formatVnd(walletBalance)}</Text>
          </View>
          <View style={styles.walletIconWrap}>
            <IconSymbol name="creditcard.fill" size={24} color={colors.brand700} />
          </View>
        </View>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton title="Nap tien" onPress={() => {}} />
        <PrimaryButton title="Lien ket the" onPress={() => {}} />
      </View>
      <Card style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Phuong thuc thanh toan</Text>
        <Text style={styles.desc}>Tien mat, The/Vi, VietQR</Text>
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
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  desc: { ...typography.body, color: colors.text }
});

export default WalletScreen;
