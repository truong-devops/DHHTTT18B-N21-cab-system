import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { colors, spacing, typography } from '../../theme/tokens';
import { Carousel } from '../../components/common/Carousel';
import { PrimaryButton } from '../../components/common/PrimaryButton';

const SplashScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 3600);
    return () => clearTimeout(timer);
  }, [navigation]);

  const slides = [
    { title: 'Đặt xe', subtitle: 'Đặt chuyến nhanh, tối ưu hành trình' },
    { title: 'Theo dõi', subtitle: 'Theo dõi tài xế theo thời gian thực' },
    { title: 'Thanh toán', subtitle: 'Thanh toán an toàn, nhiều phương thức' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>CAB KHÁCH HÀNG</Text>
      <Carousel slides={slides} activeIndex={index} onIndexChange={setIndex} />
      <PrimaryButton title="Bắt đầu" onPress={() => navigation.replace('Login')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.xl },
  logo: { ...typography.title, color: colors.brand700 }
});

export default SplashScreen;
