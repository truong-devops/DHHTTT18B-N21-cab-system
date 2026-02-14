import { useEffect, useState } from 'react';
import { 
  Alert, 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect, Ellipse, G } from 'react-native-svg';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import { palette } from '@/lib/theme';

// Driver Illustration Component
const DriverIllustration = () => (
  <Svg width="200" height="200" viewBox="0 0 200 200" fill="none">
    {/* Car Body */}
    <Path
      d="M40 120 L50 100 L70 95 L130 95 L150 100 L160 120 L160 145 L40 145 Z"
      fill="#FF5722"
    />
    
    {/* Car Top */}
    <Path
      d="M60 100 L70 80 L130 80 L140 100 Z"
      fill="#FF7043"
    />
    
    {/* Windows */}
    <Path
      d="M65 95 L72 82 L95 82 L95 95 Z"
      fill="#E3F2FD"
      opacity="0.6"
    />
    <Path
      d="M105 95 L105 82 L128 82 L135 95 Z"
      fill="#E3F2FD"
      opacity="0.6"
    />
    
    {/* Wheels */}
    <Circle cx="70" cy="145" r="15" fill="#424242" />
    <Circle cx="70" cy="145" r="8" fill="#757575" />
    <Circle cx="130" cy="145" r="15" fill="#424242" />
    <Circle cx="130" cy="145" r="8" fill="#757575" />
    
    {/* Headlights */}
    <Rect x="35" y="120" width="8" height="6" rx="2" fill="#FFF59D" />
    <Rect x="157" y="120" width="8" height="6" rx="2" fill="#FFF59D" />
    
    {/* Driver (person in car) */}
    <Circle cx="85" cy="90" r="12" fill="#FFCCBC" />
    
    {/* Driver body */}
    <Rect x="78" y="100" width="14" height="20" rx="2" fill="#1976D2" />
    
    {/* Steering wheel */}
    <Circle cx="95" cy="110" r="6" fill="#616161" stroke="#424242" strokeWidth="1.5" />
    
    {/* Road lines */}
    <Rect x="10" y="165" width="30" height="4" rx="2" fill="#FFC107" />
    <Rect x="50" y="165" width="30" height="4" rx="2" fill="#FFC107" />
    <Rect x="120" y="165" width="30" height="4" rx="2" fill="#FFC107" />
    <Rect x="160" y="165" width="30" height="4" rx="2" fill="#FFC107" />
    
    {/* Background elements - clouds */}
    <Ellipse cx="40" cy="30" rx="20" ry="12" fill="#E0E0E0" opacity="0.5" />
    <Ellipse cx="55" cy="28" rx="18" ry="10" fill="#E0E0E0" opacity="0.5" />
    <Ellipse cx="160" cy="40" rx="25" ry="15" fill="#E0E0E0" opacity="0.5" />
    <Ellipse cx="145" cy="38" rx="20" ry="12" fill="#E0E0E0" opacity="0.5" />
  </Svg>
);

export default function LoginScreen() {
  const { login, isAuthenticated, isReady } = useAuth();
  const { refresh } = useDriver();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.illustrationContainer}>
                <DriverIllustration />
              </View>
              
              <Text style={styles.title}>Đăng nhập tài xế</Text>
              <Text style={styles.subtitle}>
                Vui lòng đăng nhập để bắt đầu nhận chuyến
              </Text>
            </View>

            {/* Login Card */}
            <Card style={styles.card}>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Email/Phone Input */}
              <View style={styles.inputContainer}>
                {/* <Text style={styles.label}>Email hoặc Số điện thoại</Text> */}
                <TextInput
                  placeholder="Nhập email hoặc số điện thoại"
                  placeholderTextColor="#9CA3AF"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                {/* <Text style={styles.label}>Mật khẩu</Text> */}
                <View style={styles.passwordWrapper}>
                  <TextInput
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    style={[styles.input, styles.passwordInput]}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeText}>
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <PrimaryButton 
                title={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} 
                onPress={handleLogin}
                disabled={loading}
              />
            </Card>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity>
                <Text style={styles.registerText}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  illustrationContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    gap: 20,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    color: '#FF5722',
    fontSize: 13,
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 15,
  },
  registerText: {
    color: '#FF5722',
    fontSize: 15,
    fontWeight: '600',
  },
});