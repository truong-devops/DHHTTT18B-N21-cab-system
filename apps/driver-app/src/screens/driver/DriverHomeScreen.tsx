import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { MapScreenShell } from '../../components/common/MapScreenShell'
import { Card } from '../../components/common/Card'
import { Chip } from '../../components/common/Chip'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { EarningsWidget } from '../../components/ride/EarningsWidget'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '../../hooks/useToast'
import { useDriverOnline } from '../../hooks/useDriverOnline'
import { useIncomingRide } from '../../hooks/useIncomingRide'
import { useEarnings } from '../../hooks/useEarnings'
import { Banner } from '../../components/common/Banner'

const DriverHomeScreen = () => {
  const navigation = useNavigation()
  const { push } = useToast()
  const { online, toggleOnline, syncStatus, setError } = useDriverOnline()
  const { ride } = useIncomingRide(online)
  const { amount, error: earningsError } = useEarnings()

  useEffect(() => {
    syncStatus().catch(() => {
      // show real error via toast
    })
  }, [])

  useEffect(() => {
    if (ride?.id) {
      navigation.navigate('IncomingRide' as never, { ride } as never)
    }
  }, [ride, navigation])

  const handleToggle = async () => {
    try {
      await toggleOnline()
    } catch (err: any) {
      const message = String(err?.message || '')
      setError(message)
      if (err?.status === 409 || message.toLowerCase().includes('already online')) {
        await syncStatus()
        push('Bạn đã ONLINE sẵn', 'info')
        return
      }
      push(message || 'Không thể đổi trạng thái', 'danger')
    }
  }

  return (
    <MapScreenShell
      topSlot={
        <View style={styles.topRow}>
          <Chip label={online ? 'ONLINE' : 'OFFLINE'} variant={online ? 'success' : 'outline'} />
          <Chip label="GPS" variant="outline" />
          <Chip label="4G" variant="outline" />
        </View>
      }
      floatingSlot={online && amount !== null ? <EarningsWidget amount={amount} /> : null}
      bottomSlot={
        <Card>
          <Text style={styles.title}>{online ? 'Đang chờ chuyến...' : 'Bạn đang OFFLINE'}</Text>
          {earningsError ? <Banner variant="danger" text={earningsError} /> : null}
          <PrimaryButton title={online ? 'Chuyển OFFLINE' : 'Bật ONLINE'} onPress={handleToggle} />
        </Card>
      }
    />
  )
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.h2, marginBottom: spacing.md, color: colors.text }
})

export default DriverHomeScreen
