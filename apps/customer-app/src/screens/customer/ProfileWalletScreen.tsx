import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { OutlineButton } from '../../components/common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { formatVnd } from '../../utils/format'

const ProfileWalletScreen = () => {
  const { user, walletBalance, logout } = useCustomerStore()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile & Wallet</Text>
      <Card>
        <Text style={styles.name}>{user?.name || 'Guest User'}</Text>
        <Text style={styles.meta}>Phone: {user?.phone || '-'}</Text>
      </Card>
      <Card>
        <Text style={styles.meta}>Wallet Balance</Text>
        <Text style={styles.balance}>{formatVnd(walletBalance)}</Text>
        <Text style={styles.meta}>Saved locations: Home, Work</Text>
      </Card>
      <OutlineButton title="Logout" onPress={logout} />
      {/* TODO: Load wallet transactions + saved locations from User/Payment services */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  name: { ...typography.h2, color: colors.text },
  meta: { ...typography.body, color: colors.muted },
  balance: { ...typography.title, color: colors.success }
})

export default ProfileWalletScreen
