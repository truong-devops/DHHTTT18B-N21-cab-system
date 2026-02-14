import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { useToast } from '../../hooks/useToast'

const RatingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { submitRating } = useCustomerStore()
  const { push } = useToast()
  const [stars, setStars] = useState(5)
  const [comment, setComment] = useState('')

  const handleSubmit = async () => {
    try {
      await submitRating(stars, comment)
      push('Thanks for your feedback', 'success')
      navigation.popToTop()
    } catch (err: any) {
      push(err?.message || 'Submit rating failed', 'danger')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rating & Feedback</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setStars(value)}>
            <Text style={[styles.star, value <= stars ? styles.active : null]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Share your feedback"
        style={styles.comment}
        multiline
      />
      <PrimaryButton title="Submit" onPress={handleSubmit} />
      {/* TODO: Extend payload with tip amount once wallet/tip service is available */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text },
  starsRow: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 34, color: colors.border },
  active: { color: colors.warning },
  comment: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    textAlignVertical: 'top'
  }
})

export default RatingScreen
