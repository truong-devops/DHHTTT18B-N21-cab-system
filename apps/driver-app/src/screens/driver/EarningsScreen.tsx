import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { Card } from '../../components/common/Card'
import { Banner } from '../../components/common/Banner'
import { colors, spacing, typography } from '../../theme/tokens'
import { paymentApi } from '../../services/paymentApi'
import { formatCurrency } from '../../utils/format'

const EarningsScreen = () => {
  const [data, setData] = useState<{ today: number; week: number; trips: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await paymentApi.earnings()
        const payload = res?.data || res
        setData({
          today: payload?.today || 0,
          week: payload?.week || 0,
          trips: payload?.trips || 0
        })
        setError(null)
      } catch (err: any) {
        setError(err?.message || 'Không thể tải thu nhập')
        setData(null)
      }
    }
    load()
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Thu nhập</Text>
      {error ? <Banner variant="danger" text={error} /> : null}
      <Card style={styles.card}>
        <Text style={styles.label}>Hôm nay</Text>
        <Text style={styles.value}>{data ? formatCurrency(data.today) : '---'}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.label}>Tuần này</Text>
        <Text style={styles.value}>{data ? formatCurrency(data.week) : '---'}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.label}>Số chuyến</Text>
        <Text style={styles.value}>{data ? data.trips : '--'}</Text>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.muted },
  value: { ...typography.h2, marginTop: spacing.xs }
})

export default EarningsScreen
