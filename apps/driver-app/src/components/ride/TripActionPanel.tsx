import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../common/Card'
import { PrimaryButton } from '../common/PrimaryButton'
import { OutlineButton } from '../common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'

type Props = {
  title: string
  subtitle: string
  primaryLabel: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export const TripActionPanel: React.FC<Props> = ({
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary
}) => {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.actions}>
        <PrimaryButton title={primaryLabel} onPress={onPrimary} style={{ flex: 1 }} />
        {secondaryLabel ? (
          <OutlineButton title={secondaryLabel} onPress={onSecondary} style={{ flex: 1 }} />
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  title: { ...typography.h2, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }
})
