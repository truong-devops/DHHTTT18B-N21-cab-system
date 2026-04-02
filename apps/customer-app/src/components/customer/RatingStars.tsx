import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Props = {
  value: number
  max?: number
  onChange: (value: number) => void
}

export const RatingStars: React.FC<Props> = ({ value, max = 5, onChange }) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1
        const active = starValue <= value
        return (
          <Pressable key={starValue} onPress={() => onChange(starValue)}>
            <Text style={[styles.star, active ? styles.active : null]}>★</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 32, color: colors.border },
  active: { color: colors.warning }
})
