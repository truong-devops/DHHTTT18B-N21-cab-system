import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import { palette } from '@/lib/theme';

export default function LoginScreen() {
  const { login, isAuthenticated, isReady } = useAuth();
  const { refresh } = useDriver();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated]);

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
      router.replace('/');
    } catch (err: any) {
      setError(err?.message ?? 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Đăng nhập tài xế</Text>
        <Text style={styles.subtitle}>Vui lòng đăng nhập để nhận chuyến</Text>

        <Card style={styles.card}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    color: palette.muted,
  },
  card: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
});
