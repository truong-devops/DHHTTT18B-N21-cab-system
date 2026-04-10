import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { RideOption, RidePriceBreakdown } from '../../mock/data';
import { formatVnd } from '../../utils/format';
import { useAppPalette } from '../../theme/palette';

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

function LineItem({
  label,
  value,
  emphasized = false,
  textColor,
  mutedColor
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.value, { color: textColor }, emphasized ? styles.emphasizedValue : null]}>{value}</Text>
    </View>
  );
}

export const PriceBreakdownModal: React.FC<Props> = ({ option, visible, onClose }) => {
  const palette = useAppPalette();

  if (!option) return null;
  const breakdown = option.priceBreakdown || getFallbackBreakdown(option);
  const total = breakdown.total || option.price;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.card }]}> 
          <Text style={[styles.title, { color: palette.text }]}>Chi tiết giá</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            {option.name} · Dự kiến {option.etaMinutes} phút
          </Text>

          <LineItem label="Giá cơ bản" value={formatVnd(breakdown.baseFare)} textColor={palette.text} mutedColor={palette.muted} />
          <LineItem label="Phí quãng đường" value={formatVnd(breakdown.distanceFee)} textColor={palette.text} mutedColor={palette.muted} />
          <LineItem label="Phí thời gian" value={formatVnd(breakdown.timeFee)} textColor={palette.text} mutedColor={palette.muted} />

          {breakdown.surgeFee > 0 ? (
            <LineItem label="Phụ phí cao điểm" value={formatVnd(breakdown.surgeFee)} textColor={palette.text} mutedColor={palette.muted} />
          ) : null}
          {breakdown.discount > 0 ? (
            <LineItem label="Giảm giá" value={`- ${formatVnd(breakdown.discount)}`} textColor={palette.text} mutedColor={palette.muted} />
          ) : null}

          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <LineItem label="Tổng ước tính" value={formatVnd(total)} emphasized textColor={colors.brand700} mutedColor={palette.muted} />

          <Pressable style={styles.button} onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng chi tiết giá">
            <Text style={styles.buttonText}>Đóng</Text>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    gap: spacing.sm
  },
  title: {
    ...typography.h2
  },
  subtitle: {
    ...typography.caption
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md
  },
  label: {
    ...typography.body
  },
  value: {
    ...typography.body,
    fontWeight: '600'
  },
  emphasizedValue: {
    ...typography.h3
  },
  divider: {
    height: 1,
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
