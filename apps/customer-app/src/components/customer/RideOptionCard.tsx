import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RideOption } from '../../mock/data';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';
import { IconSymbol } from '../ui/icon-symbol';

type Props = {
  option: RideOption;
  selected?: boolean;
  onPress?: () => void;
};

function resolveVehicleIcon(option: RideOption) {
  if (option.vehicleIcon) return option.vehicleIcon;
  return option.id === 'bike' ? 'motorbike.fill' : 'car.fill';
}

export const RideOptionCard: React.FC<Props> = ({ option, selected, onPress }) => {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected ? styles.selectedCard : null]}>
      <View style={styles.headerRow}>
        <View style={styles.vehicleIconWrap}>
          <IconSymbol name={resolveVehicleIcon(option)} size={22} color={colors.brand700} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.name}>{option.name}</Text>
          <Text style={styles.subtext}>
            ETA {option.etaMinutes} min
          </Text>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.price}>{formatVnd(option.price)}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <IconSymbol name="person.fill" size={14} color={colors.muted} />
          <Text style={styles.metricText}>{option.capacity} cho</Text>
        </View>

        <View style={styles.metricChip}>
          <IconSymbol name="clock.fill" size={14} color={colors.muted} />
          <Text style={styles.metricText}>{option.etaMinutes} min</Text>
        </View>

        {option.surgeLabel ? (
          <View style={[styles.metricChip, styles.surgeChip]}>
            <IconSymbol name="flash.fill" size={14} color={colors.brand700} />
            <Text style={[styles.metricText, styles.surgeText]}>{option.surgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card + 6,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.card
  },
  selectedCard: {
    borderColor: colors.brand600,
    backgroundColor: colors.brand50
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  vehicleIconWrap: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.brand100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerText: {
    flex: 1,
    gap: 2
  },
  name: {
    ...typography.h2,
    color: colors.text
  },
  subtext: {
    ...typography.caption,
    color: colors.muted
  },
  priceBlock: {
    alignItems: 'flex-end'
  },
  price: {
    ...typography.h2,
    color: colors.brand700
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  metricText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '600'
  },
  surgeChip: {
    backgroundColor: colors.brand100
  },
  surgeText: {
    color: colors.brand700
  }
});
