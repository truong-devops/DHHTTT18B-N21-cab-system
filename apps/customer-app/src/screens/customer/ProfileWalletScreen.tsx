import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OutlineButton } from '../../components/common/OutlineButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

const primary = '#FF5A1F';
const primaryDark = '#FF3B1D';

const ProfileWalletScreen = () => {
  const { user, logout } = useCustomerStore();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: metrics.contentMaxWidth }]}> 
        <View style={styles.headerWrap}>
          <LinearGradient colors={[primary, primaryDark]} style={styles.headerGradient}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'K').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{user?.name || 'Khách'}</Text>
            <Text style={styles.sub}>4.9 • {user?.phone || '090x xxx xxx'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Thành viên</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.infoWrap}>
          <Text style={[styles.infoTitle, { color: palette.text }]}>Thông tin tài khoản</Text>
          <Text style={[styles.infoSubtitle, { color: palette.muted }]}>Thông tin chỉ để xem, không cho phép chỉnh sửa.</Text>

          <View style={[styles.infoRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.infoLabel, { color: palette.muted }]}>Họ tên</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>{user?.name || '-'}</Text>
          </View>

          <View style={[styles.infoRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.infoLabel, { color: palette.muted }]}>Email</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>{user?.email || '-'}</Text>
          </View>

          <View style={[styles.infoRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.infoLabel, { color: palette.muted }]}>Số điện thoại</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>{user?.phone || '-'}</Text>
          </View>

          <View style={[styles.infoRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.infoLabel, { color: palette.muted }]}>Mã người dùng</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>{user?.id || '-'}</Text>
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <OutlineButton title="Đăng xuất" onPress={logout} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { width: '100%', alignSelf: 'center', paddingBottom: spacing.xl },
  headerWrap: { paddingTop: spacing.lg },
  headerGradient: {
    borderRadius: 20,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden'
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF'
  },
  avatarText: { ...typography.h2, color: '#FFF', fontSize: 32 },
  name: { ...typography.title, color: '#FFF', marginTop: spacing.sm },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.9)' },
  badge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  badgeText: { ...typography.body, color: '#FFF', fontWeight: '700' },
  infoWrap: { marginTop: spacing.lg, gap: spacing.sm },
  infoTitle: { ...typography.h2 },
  infoSubtitle: { ...typography.body },
  infoLabel: { ...typography.body },
  infoValue: { ...typography.body, fontWeight: '600' },
  infoRow: {
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  logoutWrap: { marginTop: spacing.lg }
});

export default ProfileWalletScreen;
