import { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useProfile } from '@/hooks/use-profile';
import { palette } from '@/lib/theme';

type MenuItem = {
  id: string;
  label: string;
  route?: Href;
  danger?: boolean;
};

const menuItems: MenuItem[] = [
  { id: 'history', label: 'Lich su cuoc xe', route: '/(tabs)/history' },
  { id: 'wallet', label: 'Vi va doanh thu', route: '/(tabs)/wallet' },
  { id: 'settings', label: 'Cai dat' },
  { id: 'logout', label: 'Dang xuat', danger: true }
];

export default function ProfileScreen() {
  const { auth, driver: driverState, walletTotal, earnings } = useProfile();
  const { isAuthenticated, login, logout } = auth;
  const { driver, refresh } = driverState;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(() => {
    if (!driver?.fullName) return 'TX';
    const parts = driver.fullName.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }, [driver?.fullName]);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Thieu thong tin', 'Vui long nhap email/SDT va mat khau.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      await refresh();
      setPassword('');
    } catch (err: any) {
      setError(err?.message ?? 'Dang nhap that bai');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Menu tai xe</Text>

        {!isAuthenticated ? (
          <Card style={styles.loginCard}>
            <Text style={styles.sectionTitle}>Dang nhap tai xe</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TextInput placeholder="Email hoac SDT" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" style={styles.input} />
            <TextInput placeholder="Mat khau" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            <PrimaryButton title={loading ? 'Dang dang nhap...' : 'Dang nhap'} onPress={handleLogin} />
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
                  <Text style={styles.statusText}>{driver?.onlineStatus === 'ONLINE' ? 'Dang truc tuyen' : 'Ngoai tuyen'}</Text>
                </View>
              </View>
            </Card>

            <View style={styles.walletCard}>
              <Text style={styles.walletLabel}>So du vi hien tai</Text>
              <Text style={styles.walletValue}>{Number.isFinite(walletTotal) ? `${walletTotal.toLocaleString('vi-VN')} d` : '--'}</Text>
              <Text style={styles.walletHint}>Hom nay: {earnings.summary.today ? `${earnings.summary.today.toLocaleString('vi-VN')} d` : '--'}</Text>
            </View>

            <Card>
              <Text style={styles.sectionTitle}>Chuc nang</Text>
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
                  }}
                >
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
    backgroundColor: palette.background
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text
  },
  loginCard: {
    gap: 12
  },
  sectionTitle: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  profileCard: {
    padding: 16
  },
  profileHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: palette.redSoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontWeight: '700',
    color: palette.redDark,
    fontSize: 18
  },
  profileInfo: {
    flex: 1
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text
  },
  phone: {
    color: palette.muted,
    marginTop: 4
  },
  statusText: {
    marginTop: 6,
    color: palette.redDark,
    fontWeight: '600',
    fontSize: 12
  },
  walletCard: {
    backgroundColor: palette.red,
    borderRadius: 18,
    padding: 16
  },
  walletLabel: {
    color: '#FFE7DE',
    fontSize: 12
  },
  walletValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 8
  },
  walletHint: {
    color: '#FFE7DE',
    fontSize: 12,
    marginTop: 8
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border
  },
  menuItemDanger: {
    borderBottomColor: 'rgba(242, 92, 42, 0.25)'
  },
  menuText: {
    color: palette.text,
    fontWeight: '600'
  },
  menuTextDanger: {
    color: palette.redDark
  },
  menuArrow: {
    color: palette.muted,
    fontWeight: '700'
  }
});
