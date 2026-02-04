import React, { useEffect, useState } from 'react'
import { ScrollView, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import RideOptionCard from '../../components/ride/RideOptionCard'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import { getQuote } from '../../services/pricingApi'
import { createBooking } from '../../services/bookingApi'
import { useToast } from '../../hooks/useToast'

export default function RideOptionsScreen({ navigation, route }) {
  const pickup = route?.params?.pickup || { lat: 10.76, lng: 106.66 }
  const dropoff = route?.params?.dropoff || { lat: 10.78, lng: 106.68 }
  const { show } = useToast()
  const [quote, setQuote] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getQuote({
          pickup,
          dropoff,
          serviceType: 'STANDARD'
        })
        setQuote(res)
      } catch (e) {
        show(e.message || 'Không lấy được báo giá', 'danger')
      }
    }
    load()
  }, [pickup, dropoff])

  const handleBooking = async () => {
    try {
      const booking = await createBooking({
        pickup,
        dropoff,
        vehicleType: 'CAR'
      })
      navigation.navigate('Searching', {
        bookingId: booking.bookingId,
        rideId: booking.rideId
      })
    } catch (e) {
      show(e.message || 'Đặt xe thất bại', 'danger')
    }
  }

  const priceText = quote?.estimatedFare ? `${quote.estimatedFare} VND` : '...'

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Chọn dịch vụ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
        <RideOptionCard title="Standard" price={priceText} eta={quote?.durationMin || 8} />
        <RideOptionCard title="Premium" price="45.000 VND" eta={6} />
      </ScrollView>
      <PrimaryButton title="Đặt xe" onPress={handleBooking} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
