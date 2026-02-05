import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'
import { Card } from '../../components/common/Card'

const MissingConfigScreen = () => {
  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.title}>Missing API_BASE_URL</Text>
        <Text style={styles.body}>
          Vui lòng set EXPO_PUBLIC_API_BASE_URL trong apps/driver-app/.env
        </Text>
        <Text style={styles.body}>Ví dụ: http://192.168.x.x:3000</Text>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'center' },
  title: { ...typography.h2, marginBottom: spacing.md },
  body: { ...typography.body, color: colors.muted }
})

export default MissingConfigScreen
