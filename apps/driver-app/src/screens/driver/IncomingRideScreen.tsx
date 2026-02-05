import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { BottomSheet } from '../../components/common/BottomSheet'
import { IncomingRideCard } from '../../components/ride/IncomingRideCard'
import { CountdownRing } from '../../components/ride/CountdownRing'
import { useNavigation, useRoute } from '@react-navigation/native'
import { rideApi } from '../../services/rideApi'
import { driverApi } from '../../services/driverApi'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { useToast } from '../../hooks/useToast'

const IncomingRideScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainStackParamList, 'IncomingRide'>>()
  const [seconds, setSeconds] = useState(15)
  const ride = route.params?.ride
  const { push } = useToast()

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleAccept = async () => {
    try {
      if (ride?.id) {
        const profile: any = await driverApi.me()
        const driverId = profile?.driver?.id || profile?.data?.driver?.id
        if (driverId) {
          await rideApi.accept(ride.id, driverId)
        }
      }
      navigation.goBack()
      navigation.navigate('Pickup' as never, { rideId: ride?.id } as never)
    } catch (err: any) {
      push(err?.message || 'Không thể nhận chuyến', 'danger')
    }
  }

  const handleReject = async () => {
    try {
      if (ride?.id) {
        await rideApi.reject(ride.id)
      }
    } catch (err: any) {
      push(err?.message || 'Không thể từ chối chuyến', 'danger')
    } finally {
      navigation.goBack()
    }
  }

  return (
    <View style={styles.container}>
      <BottomSheet visible snapPoints={[0.35, 0.7]} snapIndex={1} onClose={handleReject}>
        <View style={styles.countdownWrap}>
          <CountdownRing seconds={seconds} />
        </View>
        <IncomingRideCard
          pickup={ride?.pickup || 'Điểm đón'}
          dropoff={ride?.dropoff || 'Điểm trả'}
          distanceKm={ride?.distanceKm || 0}
          etaMinutes={ride?.etaMinutes || 0}
          price={ride?.price || 0}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  countdownWrap: { alignItems: 'center', marginBottom: 12 }
})

export default IncomingRideScreen
