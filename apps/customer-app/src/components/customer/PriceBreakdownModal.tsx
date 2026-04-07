import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import type { RideOption } from '../../mock/data';
import { formatVnd } from '../../utils/format';

type Props = {
  option?: RideOption | null;
  visible: boolean;
  onClose: () => void;
};

export const PriceBreakdownModal: React.FC<Props> = ({ option, visible, onClose }) => {
  if (!option) return null;
  const baseFare = option.price * 0.8;
  const surge = option.surgeLabel ? option.price * 0.2 : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Chi tiết giá</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cước cơ bản</Text>
            <Text style={styles.value}>{formatVnd(baseFare)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phụ phí / Surge</Text>
            <Text style={styles.value}>{formatVnd(surge)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tổng ước tính</Text>
            <Text style={[styles.value, styles.total]}>{formatVnd(option.price)}</Text>
          </View>
          <Pressable style={styles.button} onPress={onClose}>
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
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    gap: spacing.md
  },
  title: { ...typography.h3, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.body, color: colors.muted },
  value: { ...typography.body, color: colors.text },
  total: { ...typography.h3, color: colors.brand700 },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.brand600,
    alignItems: 'center'
  },
  buttonText: { ...typography.body, color: colors.white, fontWeight: '600' }
});
