import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCustomerStore } from '../../store/customerStore';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { IconSymbol } from '../../components/ui/icon-symbol';
import type { MainStackParamList } from '../../navigation/MainStack';
import { listPaymentMethods, type PaymentMethodItem } from '../../lib/settings-storage';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { StateView } from '../../components/common/StateView';

const accent = '#FFF4F1';

const WalletScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { walletBalance } = useCustomerStore();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listPaymentMethods();
      setMethods(items);
    } catch {
      setError('Không tải được phương thức thanh toán.');
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshMethods();
    }, [refreshMethods])
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: metrics.contentMaxWidth }]}> 
        <Text style={[styles.title, { color: palette.text }]}>Ví của bạn</Text>

        <Card style={[styles.balanceCard, { backgroundColor: accent }]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.label, { color: palette.muted }]}>Số dư khả dụng</Text>
              <Text style={styles.amount}>{formatVnd(walletBalance)}</Text>
            </View>
            <View style={[styles.walletIconWrap, { backgroundColor: palette.surface }]}>
              <IconSymbol name="creditcard.fill" size={24} color={colors.brand700} />
            </View>
          </View>
        </Card>

        <View style={[styles.actions, metrics.isCompact ? styles.actionsCompact : null]}>
          <View style={styles.actionBtn}>
            <PrimaryButton title="Nạp tiền" onPress={() => Alert.alert('Thông báo', 'Tính năng nạp tiền sẽ được bổ sung ở backend sau.')} />
          </View>
          <View style={styles.actionBtn}>
            <PrimaryButton title="Quản lý phương thức" onPress={() => navigation.navigate('PaymentMethods')} />
          </View>
        </View>

        <Card style={styles.methodCard}>
          <Text style={[styles.label, { color: palette.muted }]}>Phương thức thanh toán</Text>

          {loading ? (
            <View style={styles.skeletonList}>
              <SkeletonBlock height={22} />
              <SkeletonBlock height={22} width="88%" />
            </View>
          ) : error ? (
            <StateView type="error" title="Không tải được dữ liệu" message={error} actionLabel="Thử lại" onAction={() => void refreshMethods()} />
          ) : methods.length ? (
            methods.map((method) => (
              <View key={method.id} style={styles.methodRow}>
                <Text style={[styles.desc, { color: palette.text }]}>
                  {method.label}
                  {method.details ? ` - ${method.details}` : ''}
                </Text>
                {method.isDefault ? <Text style={styles.defaultTag}>Mặc định</Text> : null}
              </View>
            ))
          ) : (
            <StateView type="empty" title="Chưa có phương thức" message="Bạn có thể thêm trong phần Quản lý phương thức." />
          )}
        </Card>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.bg }]}> 
        <PrimaryButton title="Mở quản lý phương thức" onPress={() => navigation.navigate('PaymentMethods')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { width: '100%', alignSelf: 'center', paddingTop: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title },
  balanceCard: {},
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.body },
  amount: { ...typography.title, color: colors.brand700 },
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionsCompact: { flexDirection: 'column' },
  actionBtn: { flex: 1 },
  methodCard: { gap: spacing.xs },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  desc: { ...typography.body, flex: 1 },
  defaultTag: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700'
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  skeletonList: { gap: spacing.sm }
});

export default WalletScreen;

