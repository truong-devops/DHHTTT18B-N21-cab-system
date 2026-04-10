import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../navigation/MainStack';
import { customerApi } from '../../services/customerApi';
import type { RideOption } from '../../mock/data';
import { RideOptionCard } from '../../components/customer/RideOptionCard';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { OutlineButton } from '../../components/common/OutlineButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';
import { useToast } from '../../hooks/useToast';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PriceBreakdownModal } from '../../components/customer/PriceBreakdownModal';

const RideOptionsScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'RideOptions'>>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { chooseOption, selectedOption } = useCustomerStore();
  const [options, setOptions] = useState<RideOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    let disposed = false;
    setLoading(true);

    customerApi
      .getRideOptions(route.params.pickup, route.params.destination)
      .then((result) => {
        if (disposed) return;
        setOptions(result);
        if (!selectedOption && result.length > 0) {
          chooseOption(result[0]);
        }
      })
      .catch((error) => {
        if (disposed) return;
        push(error?.message || 'Khong tai duoc lua chon xe', 'danger');
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [chooseOption, push, route.params.destination, route.params.pickup, selectedOption]);

  const activeOption = useMemo(() => {
    if (!selectedOption) return null;
    return options.find((item) => item.id === selectedOption.id) || selectedOption;
  }, [options, selectedOption]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride options</Text>
        <Text style={styles.subtitle}>{`${route.params.pickup} -> ${route.params.destination}`}</Text>
      </View>

      <View style={styles.optionSection}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand600} />
          </View>
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
          title="Tim tai xe"
          onPress={() => {
            if (!activeOption) {
              push('Vui long chon mot loai xe', 'danger');
              return;
            }
            navigation.navigate('SearchingDriver', route.params);
          }}
        />
        <OutlineButton title="Xem chi tiet gia" onPress={() => setShowBreakdown(true)} disabled={!activeOption} />
      </View>

      <PriceBreakdownModal option={activeOption} visible={showBreakdown} onClose={() => setShowBreakdown(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  header: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xs
  },
  title: {
    ...typography.title,
    color: colors.text
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted
  },
  optionSection: { paddingHorizontal: spacing.xl },
  loadingWrap: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionList: { gap: spacing.sm },
  optionItem: { width: '100%' },
  actions: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  }
});

export default RideOptionsScreen;
