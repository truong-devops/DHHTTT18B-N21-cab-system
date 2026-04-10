import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DriverInfo } from '../../mock/data';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  driver: DriverInfo;
  etaMinutes: number;
  onCallPress?: (phone?: string | null) => void;
  onChatPress?: (phone?: string | null) => void;
};

function toInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return 'TX';
  const parts = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function normalizePhone(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '');
}

function resolveStatusMeta(etaMinutes: number, mutedColor: string) {
  if (etaMinutes <= 2) {
    return {
      label: 'Sắp đến điểm đón',
      backgroundColor: '#E7F7EC',
      textColor: '#1F9254'
    };
  }
  if (etaMinutes <= 5) {
    return {
      label: 'Đang đến điểm đón',
      backgroundColor: colors.brand100,
      textColor: colors.brand700
    };
  }
  return {
    label: 'Đang di chuyển',
    backgroundColor: '#EEF2F7',
    textColor: mutedColor
  };
}

export const DriverInfoCard: React.FC<Props> = ({ driver, etaMinutes, onCallPress, onChatPress }) => {
  const palette = useAppPalette();

  const ratingLabel = typeof driver.rating === 'number' && Number.isFinite(driver.rating) ? String(driver.rating) : 'Không có dữ liệu';
  const plateLabel = driver.plate && driver.plate.trim() ? driver.plate : 'Không có dữ liệu';
  const vehicleLabel = driver.vehicle && driver.vehicle.trim() ? driver.vehicle : 'Không có dữ liệu';
  const phoneLabel = normalizePhone(driver.phone);
  const initials = useMemo(() => toInitials(driver.name || 'Tài xế'), [driver.name]);
  const avatarUrl = typeof driver.avatarUrl === 'string' && driver.avatarUrl.trim() ? driver.avatarUrl.trim() : null;
  const statusMeta = useMemo(() => resolveStatusMeta(etaMinutes, palette.muted), [etaMinutes, palette.muted]);

  const handleCall = async () => {
    if (onCallPress) {
      onCallPress(phoneLabel);
      return;
    }

    if (!phoneLabel) {
      Alert.alert('Không có số điện thoại', 'Thông tin tài xế chưa có số điện thoại.');
      return;
    }

    const callUrl = `tel:${phoneLabel}`;
    try {
      const supported = await Linking.canOpenURL(callUrl);
      if (!supported) {
        Alert.alert('Không thể gọi', 'Thiết bị không hỗ trợ tính năng gọi trực tiếp.');
        return;
      }
      await Linking.openURL(callUrl);
    } catch {
      Alert.alert('Không thể gọi', 'Vui lòng thử lại sau.');
    }
  };

  const handleChat = async () => {
    if (onChatPress) {
      onChatPress(phoneLabel);
      return;
    }

    if (!phoneLabel) {
      Alert.alert('Không có số điện thoại', 'Thông tin tài xế chưa có số điện thoại.');
      return;
    }

    const chatUrl = `sms:${phoneLabel}`;
    try {
      const supported = await Linking.canOpenURL(chatUrl);
      if (!supported) {
        Alert.alert('Không thể nhắn tin', 'Thiết bị không hỗ trợ tính năng nhắn tin.');
        return;
      }
      await Linking.openURL(chatUrl);
    } catch {
      Alert.alert('Không thể nhắn tin', 'Vui lòng thử lại sau.');
    }
  };

  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusMeta.backgroundColor }]}>
          <Text style={[styles.statusText, { color: statusMeta.textColor }]}>{statusMeta.label}</Text>
        </View>
        <View style={styles.etaBadge}>
          <MaterialIcons name="schedule" size={12} color={colors.brand700} />
          <Text style={styles.etaBadgeText}>Dự kiến {etaMinutes} phút</Text>
        </View>
      </View>

      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: palette.text }]}>{driver.name || 'Tài xế'}</Text>
          <View style={styles.ratingRow}>
            <MaterialIcons name="star" size={14} color={colors.warning} />
            <Text style={[styles.ratingText, { color: palette.text }]}>{ratingLabel} / 5.0</Text>
          </View>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={[styles.metricChip, { backgroundColor: palette.surface2 }]}> 
          <MaterialIcons name="directions-car" size={14} color={palette.muted} />
          <Text style={[styles.metricText, { color: palette.muted }]}>{vehicleLabel}</Text>
        </View>
        <View style={[styles.metricChip, { backgroundColor: palette.surface2 }]}> 
          <MaterialIcons name="local-offer" size={14} color={palette.muted} />
          <Text style={[styles.metricText, { color: palette.muted }]}>{plateLabel}</Text>
        </View>
      </View>

      <View style={styles.phoneRow}>
        <MaterialIcons name="phone" size={14} color={palette.muted} />
        <Text style={[styles.phoneText, { color: palette.muted }]}>{phoneLabel || 'Không có số điện thoại'}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.callButton, pressed ? styles.callButtonPressed : null]}
          onPress={handleCall}
          accessibilityRole="button"
          accessibilityLabel="Gọi tài xế"
        >
          <MaterialIcons name="phone" size={16} color={colors.white} />
          <Text style={styles.callText}>Gọi</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.chatButton, { borderColor: palette.border, backgroundColor: palette.surface }, pressed ? styles.actionPressed : null]}
          onPress={handleChat}
          accessibilityRole="button"
          accessibilityLabel="Nhắn tin tài xế"
        >
          <MaterialIcons name="chat" size={16} color={colors.brand700} />
          <Text style={styles.chatText}>Nhắn tin</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700'
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  etaBadgeText: {
    ...typography.caption,
    color: colors.brand700,
    fontWeight: '700'
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  headerInfo: {
    flex: 1,
    gap: 2
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand100,
    overflow: 'hidden'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  avatarText: {
    ...typography.h2,
    color: colors.brand700
  },
  title: { ...typography.h2, fontWeight: '700' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingText: {
    ...typography.caption,
    fontWeight: '600'
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  metricText: {
    ...typography.caption,
    fontWeight: '600'
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  phoneText: {
    ...typography.body
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44
  },
  callButton: {
    backgroundColor: colors.brand600
  },
  callButtonPressed: {
    backgroundColor: colors.brand700
  },
  chatButton: {
    borderWidth: 1
  },
  actionPressed: {
    opacity: 0.85
  },
  callText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700'
  },
  chatText: {
    ...typography.body,
    color: colors.brand700,
    fontWeight: '600'
  }
});
