import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../components/common/Card';
import { OutlineButton } from '../../components/common/OutlineButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import type { MainStackParamList } from '../../navigation/MainStack';
import { useCustomerStore } from '../../store/customerStore';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

type RequiredPaymentCode = 'CASH' | 'CARD' | 'WALLET';

type RequiredMethod = {
  code: RequiredPaymentCode;
  label: string;
};

const requiredMethods: RequiredMethod[] = [
  { label: 'Cash', code: 'CASH' },
  { label: 'Card', code: 'CARD' },
  { label: 'Wallet', code: 'WALLET' }
];

const PaymentScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { activeRide, completeRidePayment } = useCustomerStore();
  const { push } = useToast();
  const [method, setMethod] = useState<RequiredMethod>(requiredMethods[0]);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);
      await completeRidePayment(method.code);
      navigation.replace('Rating');
    } catch (err: any) {
      push(err?.message || 'Thanh toan that bai', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thanh toan</Text>

      <Card>
        <Text style={styles.label}>Tong cuoc phi</Text>
        <Text style={styles.amount}>{formatVnd(activeRide?.option.price || 0)}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Phuong thuc thanh toan</Text>
        {requiredMethods.map((item) =>
          item.code === method.code ? (
            <PrimaryButton key={item.code} title={`${item.label} (da chon)`} onPress={() => setMethod(item)} />
          ) : (
            <OutlineButton key={item.code} title={item.label} onPress={() => setMethod(item)} />
          )
        )}
      </Card>

      <PrimaryButton title={loading ? 'Dang xu ly...' : 'Thanh toan'} onPress={handlePay} disabled={loading} />

      <OutlineButton
        title="VietQR (tuy chon)"
        onPress={() => push('VietQR la phuong thuc tuy chon, se mo khi backend san sang.', 'info')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  label: { ...typography.body, color: colors.muted },
  amount: { ...typography.title, color: colors.brand700 }
});

export default PaymentScreen;
