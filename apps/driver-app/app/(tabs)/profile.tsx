import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import * as paymentApi from '@/lib/services/payment';
import { palette } from '@/lib/theme';

const menuItems = [
  { id: 'history', label: 'Lịch sử cuốc xe', route: '/(tabs)/history' },
  { id: 'wallet', label: 'Ví & doanh thu', route: '/(tabs)/wallet' },
  { id: 'settings', label: 'Cài đặt' },
  { id: 'logout', label: 'Đăng xuất', danger: true },
];

export default function ProfileScreen() {
  const { isAuthenticated, login, logout } = useAuth();
  const { driver, refresh } = useDriver();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletTotal, setWalletTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setWalletTotal(null);
      return;
    }

    paymentApi
      .listPayments(10)
      .then((res) => {
        const total = (res.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        setWalletTotal(total);
      })
      .catch(() => {
        setWalletTotal(null);
      });
  }, [isAuthenticated]);

  const initials = useMemo(() => {
    if (!driver?.fullName) return 'TX';
    const parts = driver.fullName.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }, [driver?.fullName]);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email/sđt và mật khẩu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      await refresh();
      setPassword('');
    } catch (err: any) {
      setError(err?.message ?? 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Menu tài xế</Text>

        {!isAuthenticated ? (
          <Card style={styles.loginCard}>
            <Text style={styles.sectionTitle}>Đăng nhập tài xế</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TextInput
              placeholder="Email hoặc SĐT"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              placeholder="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            <PrimaryButton title={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={handleLogin} />
          </Card>
        ) : (
          <>
            <Card style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.name}>{driver?.fullName ?? '--'}</Text>
                  <Text style={styles.phone}>{driver?.phone ?? '--'}</Text>
                  <Text style={styles.statusText}>
                    {driver?.onlineStatus === 'ONLINE' ? 'Đang trực tuyến' : 'Ngoại tuyến'}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.walletCard}>
              <Text style={styles.walletLabel}>Số dư ví hiện tại</Text>
              <Text style={styles.walletValue}>
                {walletTotal !== null ? `${walletTotal.toLocaleString('vi-VN')} đ` : '--'}
              </Text>
              <Text style={styles.walletHint}>Hôm nay: --</Text>
            </View>

            <Card>
              <Text style={styles.sectionTitle}>Chức năng</Text>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, item.danger && styles.menuItemDanger]}
                  onPress={() => {
                    if (item.id === 'logout') {
                      void logout();
                      return;
                    }
                    if (item.route) router.push(item.route);
                  }}>
                  <Text style={[styles.menuText, item.danger && styles.menuTextDanger]}>{item.label}</Text>
                  <Text style={[styles.menuArrow, item.danger && styles.menuTextDanger]}>{'>'}</Text>
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  loginCard: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileCard: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: palette.redSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: palette.redDark,
    fontSize: 18,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  phone: {
    color: palette.muted,
    marginTop: 4,
  },
  statusText: {
    marginTop: 6,
    color: palette.redDark,
    fontWeight: '600',
    fontSize: 12,
  },
  walletCard: {
    backgroundColor: palette.red,
    borderRadius: 18,
    padding: 16,
  },
  walletLabel: {
    color: '#FFE7DE',
    fontSize: 12,
  },
  walletValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 8,
  },
  walletHint: {
    color: '#FFE7DE',
    fontSize: 12,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  menuItemDanger: {
    borderBottomColor: 'rgba(242, 92, 42, 0.25)',
  },
  menuText: {
    color: palette.text,
    fontWeight: '600',
  },
  menuTextDanger: {
    color: palette.redDark,
  },
  menuArrow: {
    color: palette.muted,
    fontWeight: '700',
  },
});
