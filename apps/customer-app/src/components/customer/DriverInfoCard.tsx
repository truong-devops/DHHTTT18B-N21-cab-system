import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DriverInfo } from '../../mock/data';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = {
  driver: DriverInfo;
  etaMinutes: number;
};

export const DriverInfoCard: React.FC<Props> = ({ driver, etaMinutes }) => {
  const ratingLabel = typeof driver.rating === 'number' && Number.isFinite(driver.rating) ? String(driver.rating) : 'Khong co du lieu';
  const plateLabel = driver.plate && driver.plate.trim() ? driver.plate : 'Khong co du lieu';
  const vehicleLabel = driver.vehicle && driver.vehicle.trim() ? driver.vehicle : 'Khong co du lieu';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Da tim thay tai xe</Text>
      <Text style={styles.line}>
        {driver.name} | {vehicleLabel}
      </Text>
      <Text style={styles.line}>
        Bien so {plateLabel} | Danh gia {ratingLabel}
      </Text>
      <Text style={styles.eta}>Thoi gian den du kien: {etaMinutes} phut</Text>
      {/* TODO: Integrate call/chat actions with Communication Service */}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs
  },
  title: { ...typography.h2, color: colors.text },
  line: { ...typography.body, color: colors.muted },
  eta: { ...typography.body, color: colors.brand700, fontWeight: '600' }
});
