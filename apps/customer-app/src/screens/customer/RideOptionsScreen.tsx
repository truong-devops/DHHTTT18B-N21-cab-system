import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../navigation/MainStack';
import { customerApi } from '../../services/customerApi';
import type { RideOption } from '../../mock/data';
import { RideOptionCard } from '../../components/customer/RideOptionCard';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { OutlineButton } from '../../components/common/OutlineButton';
import { spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';
import { useToast } from '../../hooks/useToast';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PriceBreakdownModal } from '../../components/customer/PriceBreakdownModal';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { StateView } from '../../components/common/StateView';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

const RideOptionsScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'RideOptions'>>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { chooseOption, selectedOption } = useCustomerStore();
  const { push } = useToast();
  const metrics = useScreenMetrics();
  const colors = useAppPalette();

  const [options, setOptions] = useState<RideOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fetchOptions = useCallback(() => {
    let disposed = false;
    setLoading(true);
    setError(null);

    customerApi
      .getRideOptions(route.params.pickup, route.params.destination)
      .then((result) => {
        if (disposed) return;
        setOptions(result);
        if (!selectedOption && result.length > 0) {
          chooseOption(result[0]);
        }
      })
      .catch((fetchError) => {
        if (disposed) return;
        const message = fetchError?.message || 'Không tải được lựa chọn xe';
        setError(message);
        push(message, 'danger');
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [chooseOption, push, route.params.destination, route.params.pickup, selectedOption]);

  useEffect(() => {
    const dispose = fetchOptions();
    return dispose;
  }, [fetchOptions]);

  const activeOption = useMemo(() => {
    if (!selectedOption) return null;
    return options.find((item) => item.id === selectedOption.id) || selectedOption;
  }, [options, selectedOption]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <View style={[styles.contentWrap, { maxWidth: metrics.contentMaxWidth }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Lựa chọn chuyến xe</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{`${route.params.pickup} → ${route.params.destination}`}</Text>
        </View>

        <View style={styles.optionSection}>
          {loading ? (
            <View style={styles.optionList}>
              <SkeletonBlock height={92} />
              <SkeletonBlock height={92} />
              <SkeletonBlock height={92} />
            </View>
          ) : error ? (
            <StateView type="error" title="Không tải được lựa chọn xe" message={error} actionLabel="Thử lại" onAction={fetchOptions} />
          ) : !options.length ? (
            <StateView type="empty" title="Không có lựa chọn xe" message="Thử đổi điểm đón hoặc điểm đến để tìm lại." />
          ) : (
            <View style={styles.optionList}>
              {options.map((item) => (
                <View key={item.id} style={styles.optionItem}>
                  <RideOptionCard option={item} selected={activeOption?.id === item.id} onPress={() => chooseOption(item)} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Tìm tài xế"
            onPress={() => {
              if (!activeOption) {
                push('Vui lòng chọn một loại xe', 'danger');
                return;
              }
              navigation.navigate('SearchingDriver', route.params);
            }}
          />
          <OutlineButton title="Xem chi tiết giá" onPress={() => setShowBreakdown(true)} disabled={!activeOption} />
        </View>
      </View>

      <PriceBreakdownModal option={activeOption} visible={showBreakdown} onClose={() => setShowBreakdown(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl
  },
  contentWrap: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
    flex: 1
  },
  header: {
    gap: spacing.xs
  },
  title: {
    ...typography.title
  },
  subtitle: {
    ...typography.caption
  },
  optionSection: { flex: 1 },
  optionList: { gap: spacing.sm },
  optionItem: { width: '100%' },
  actions: {
    gap: spacing.sm
  }
});

export default RideOptionsScreen;
