import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { InputField } from '../../components/common/InputField';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { TextArea } from '../../components/common/TextArea';
import { RatingStars } from '../../components/customer/RatingStars';
import type { MainStackParamList } from '../../navigation/MainStack';
import { useCustomerStore } from '../../store/customerStore';
import { colors, spacing, typography } from '../../theme/tokens';
import { useToast } from '../../hooks/useToast';

function parseTipAmount(raw: string): { value: number | null; error?: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { value: null };

  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return { value: null, error: 'Tien tip khong hop le.' };
  }

  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 0) {
    return { value: null, error: 'Tien tip khong hop le.' };
  }

  return { value: amount };
}

const RatingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { submitRating } = useCustomerStore();
  const { push } = useToast();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    const parsedTip = parseTipAmount(tip);
    if (parsedTip.error) {
      push(parsedTip.error, 'danger');
      return;
    }

    try {
      setLoading(true);
      await submitRating(stars, comment, parsedTip.value);
      push('Cam on ban da danh gia', 'success');
      navigation.popToTop();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('Idempotency key reuse with different request')) {
        push('Yeu cau danh gia truoc do chua hoan tat. Vui long thu lai sau it giay.', 'danger');
      } else if (message.includes('Review already exists for this ride')) {
        push('Chuyen di nay da duoc danh gia truoc do.', 'info');
        navigation.popToTop();
      } else {
        push(message || 'Gui danh gia that bai', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Danh gia chuyen di</Text>
      <RatingStars value={stars} onChange={setStars} />
      <TextArea value={comment} onChangeText={setComment} placeholder="Chia se cam nhan cua ban" />
      <InputField label="Tien tip (tuy chon)" value={tip} onChangeText={setTip} keyboardType="numeric" placeholder="Vi du: 20000" />
      <PrimaryButton title={loading ? 'Dang gui...' : 'Gui danh gia'} onPress={handleSubmit} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text }
});

export default RatingScreen;
