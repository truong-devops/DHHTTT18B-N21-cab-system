import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';
import { useToast } from '../../hooks/useToast';
import { RatingStars } from '../../components/customer/RatingStars';
import { TextArea } from '../../components/common/TextArea';
import { InputField } from '../../components/common/InputField';

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

    try {
      setLoading(true);
      await submitRating(stars, comment);
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
    <View style={styles.container}>
      <Text style={styles.title}>Đánh giá chuyến đi</Text>
      <RatingStars value={stars} onChange={setStars} />
      <TextArea value={comment} onChangeText={setComment} placeholder="Chia sẻ cảm nhận của bạn" />
      <InputField label="Tiền tip (tùy chọn)" value={tip} onChangeText={setTip} keyboardType="numeric" placeholder="Ví dụ: 20.000đ" />
      <PrimaryButton title={loading ? 'Đang gửi...' : 'Gửi đánh giá'} onPress={handleSubmit} disabled={loading} />
      {/* TODO: Extend payload with tip amount once wallet/tip service is available */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text }
});

export default RatingScreen;
