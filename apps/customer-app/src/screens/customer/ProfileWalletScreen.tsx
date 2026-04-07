import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OutlineButton } from '../../components/common/OutlineButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';

const primary = '#FF5A1F';
const primaryDark = '#FF3B1D';
const sectionBg = '#F9F4F2';

const ProfileWalletScreen = () => {
  const { user, logout, updateProfile } = useCustomerStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
  }, [user]);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateProfile({ name, email, phone });
      Alert.alert('Thành công', 'Đã cập nhật thông tin tài khoản.');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Header */}
        <View style={styles.headerWrap}>
          <LinearGradient colors={[primary, primaryDark]} style={styles.headerGradient}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'K').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{user?.name || 'Khách'}</Text>
            <Text style={styles.sub}>★ 4.9 · {user?.phone || '090x xxx xxx'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Thành viên</Text>
            </View>
            <View style={styles.editBtn}>
              <Text style={styles.editIcon}>✎</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Thông tin thật từ backend */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.h2, color: colors.text }}>Thông tin thật</Text>
          <Text style={{ ...typography.body, color: colors.muted }}>Dữ liệu lấy trực tiếp từ database qua API Gateway.</Text>
          <View style={styles.formRow}>
            <Text style={styles.infoLabel}>Họ tên</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nhập họ tên" />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="09xxxxxxx" keyboardType="phone-pad" />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.id}</Text>
          </View>
          <PrimaryButton title={saving ? 'Đang lưu...' : 'Lưu thay đổi'} onPress={onSave} disabled={saving} />
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <OutlineButton title="Đăng xuất" onPress={logout} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: sectionBg },
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerGradient: {
    borderRadius: 20,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    position: 'relative',
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
  editBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  editIcon: { ...typography.body, color: primary },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  infoLabel: { ...typography.body, color: colors.muted },
  infoValue: { ...typography.body, color: colors.text, fontWeight: '600' },
  formRow: { gap: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    color: colors.text
  }
});

export default ProfileWalletScreen;
