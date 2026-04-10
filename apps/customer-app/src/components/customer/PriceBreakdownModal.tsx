import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { RideOption, RidePriceBreakdown } from '../../mock/data';
import { formatVnd } from '../../utils/format';

type Props = {
  option?: RideOption | null;
  visible: boolean;
  onClose: () => void;
};

function getFallbackBreakdown(option: RideOption): RidePriceBreakdown {
  const subtotal = Math.round(option.price * 0.85);
  const surgeFee = option.surgeLabel ? Math.max(Math.round(option.price * 0.15), 0) : 0;
  return {
    baseFare: subtotal,
    distanceFee: 0,
    timeFee: 0,
    surgeFee,
    discount: 0,
    subtotal,
    total: option.price,
    currency: 'VND'
  };
}

function LineItem({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, emphasized ? styles.emphasizedValue : null]}>{value}</Text>
    </View>
  );
}

export const PriceBreakdownModal: React.FC<Props> = ({ option, visible, onClose }) => {
  if (!option) return null;
  const breakdown = option.priceBreakdown || getFallbackBreakdown(option);
  const total = breakdown.total || option.price;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Price breakdown</Text>
          <Text style={styles.subtitle}>
            {option.name} · ETA {option.etaMinutes} min
          </Text>

          <LineItem label="Base fare" value={formatVnd(breakdown.baseFare)} />
          <LineItem label="Distance fee" value={formatVnd(breakdown.distanceFee)} />
          <LineItem label="Time fee" value={formatVnd(breakdown.timeFee)} />

          {breakdown.surgeFee > 0 ? <LineItem label="Surge fee" value={formatVnd(breakdown.surgeFee)} /> : null}
          {breakdown.discount > 0 ? <LineItem label="Discount" value={`- ${formatVnd(breakdown.discount)}`} /> : null}

          <View style={styles.divider} />
          <LineItem label="Estimated total" value={formatVnd(total)} emphasized />

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    gap: spacing.sm
  },
  title: {
    ...typography.h2,
    color: colors.text
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md
  },
  label: {
    ...typography.body,
    color: colors.muted
  },
  value: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600'
  },
  emphasizedValue: {
    ...typography.h3,
    color: colors.brand700
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.brand600,
    alignItems: 'center'
  },
  buttonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600'
  }
});
