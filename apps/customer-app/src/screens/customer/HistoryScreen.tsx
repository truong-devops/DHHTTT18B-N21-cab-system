import React, { useEffect } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useCustomerStore } from '../../store/customerStore'
import { RideHistoryCard } from '../../components/customer/RideHistoryCard'
import { colors, spacing, typography } from '../../theme/tokens'

const HistoryScreen = () => {
  const { history, loadHistory } = useCustomerStore()

  useEffect(() => {
    loadHistory().catch(() => {
      // keep demo simple
    })
  }, [loadHistory])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch sử chuyến đi</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RideHistoryCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
      {/* TODO: Add date/status filter query params with Ride Service history API */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text }
})

export default HistoryScreen
