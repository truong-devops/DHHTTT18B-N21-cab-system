import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../components/common/Card';
import { OutlineButton } from '../../components/common/OutlineButton';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { useCustomerStore } from '../../store/customerStore';
import { colors, spacing, typography } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/MainStack';
import { listPaymentMethods, listSavedLocations } from '../../lib/settings-storage';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { StateView } from '../../components/common/StateView';

const SettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { logout } = useCustomerStore();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

  const [savedLocationCount, setSavedLocationCount] = useState(0);
  const [paymentMethodCount, setPaymentMethodCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locations, methods] = await Promise.all([listSavedLocations(), listPaymentMethods()]);
      setSavedLocationCount(locations.length);
      setPaymentMethodCount(methods.length);
    } catch {
      setError('Không tải được dữ liệu cài đặt.');
      setSavedLocationCount(0);
      setPaymentMethodCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
    }, [refreshData])
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: metrics.contentMaxWidth }]}> 
        <Text style={[styles.title, { color: palette.text }]}>Cài đặt</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Chỉ giữ các chức năng cần thiết: địa điểm đã lưu, thanh toán, đăng xuất.</Text>

        {loading ? (
          <View style={styles.skeletonWrap}>
            <SkeletonBlock height={48} />
            <SkeletonBlock height={48} />
          </View>
        ) : error ? (
          <StateView type="error" title="Không tải được cài đặt" message={error} actionLabel="Thử lại" onAction={() => void refreshData()} />
        ) : (
          <Card style={styles.card}>
            <Pressable
              style={styles.menuRow}
              onPress={() => navigation.navigate('SavedLocations')}
              accessibilityRole="button"
              accessibilityLabel="Mở quản lý địa điểm đã lưu"
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconWrap}>
                  <IconSymbol name="location.fill" size={18} color={colors.brand700} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: palette.text }]}>Địa điểm đã lưu</Text>
                  <Text style={[styles.menuSub, { color: palette.muted }]}>{savedLocationCount} địa điểm</Text>
                </View>
              </View>
              <Text style={[styles.menuArrow, { color: palette.muted }]}>{'>'}</Text>
            </Pressable>

            <Pressable
              style={styles.menuRow}
              onPress={() => navigation.navigate('PaymentMethods')}
              accessibilityRole="button"
              accessibilityLabel="Mở quản lý phương thức thanh toán"
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconWrap}>
                  <IconSymbol name="creditcard.fill" size={18} color={colors.brand700} />
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: palette.text }]}>Phương thức thanh toán</Text>
                  <Text style={[styles.menuSub, { color: palette.muted }]}>{paymentMethodCount} phương thức</Text>
                </View>
              </View>
              <Text style={[styles.menuArrow, { color: palette.muted }]}>{'>'}</Text>
            </Pressable>
          </Card>
        )}

        <OutlineButton title="Đăng xuất" onPress={logout} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  title: { ...typography.title },
  subtitle: { ...typography.body },
  card: { gap: spacing.sm },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,31,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuTitle: { ...typography.body, fontWeight: '600' },
  menuSub: { ...typography.caption },
  menuArrow: { ...typography.h3 },
  skeletonWrap: { gap: spacing.sm }
});

export default SettingsScreen;
