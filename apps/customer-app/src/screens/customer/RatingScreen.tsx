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
import { spacing, typography } from '../../theme/tokens';
import { useToast } from '../../hooks/useToast';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

function parseTipAmount(raw: string): { value: number | null; error?: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { value: null };

  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return { value: null, error: 'Tiền tip không hợp lệ.' };
  }

  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 0) {
    return { value: null, error: 'Tiền tip không hợp lệ.' };
  }

  return { value: amount };
}

const RatingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { submitRating } = useCustomerStore();
  const { push } = useToast();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

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
      push('Cảm ơn bạn đã đánh giá', 'success');
      navigation.popToTop();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('Idempotency key reuse with different request')) {
        push('Yêu cầu đánh giá trước đó chưa hoàn tất. Vui lòng thử lại sau ít giây.', 'danger');
      } else if (message.includes('Review already exists for this ride')) {
        push('Chuyến đi này đã được đánh giá trước đó.', 'info');
        navigation.popToTop();
      } else {
        push(message || 'Gửi đánh giá thất bại', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <View style={[styles.contentWrap, { maxWidth: metrics.contentMaxWidth }]}>
        <Text style={[styles.title, { color: palette.text }]}>Đánh giá chuyến đi</Text>
        <RatingStars value={stars} onChange={setStars} />
        <TextArea value={comment} onChangeText={setComment} placeholder="Chia sẻ cảm nhận của bạn" />
        <InputField label="Tiền tip (tùy chọn)" value={tip} onChangeText={setTip} keyboardType="numeric" placeholder="Ví dụ: 20000" />
        <PrimaryButton title={loading ? 'Đang gửi...' : 'Gửi đánh giá'} onPress={handleSubmit} disabled={loading} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  contentWrap: { width: '100%', alignSelf: 'center', gap: spacing.lg },
  title: { ...typography.title }
});

export default RatingScreen;
