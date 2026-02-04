import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import HomeMapPickupScreen from '../../pages/home/HomeMapPickupScreen'
import DestinationScreen from '../../pages/home/DestinationScreen'
import RideOptionsScreen from '../../pages/ride/RideOptionsScreen'
import SearchingDriverScreen from '../../pages/ride/SearchingDriverScreen'
import RideTrackingScreen from '../../pages/ride/RideTrackingScreen'
import PaymentScreen from '../../pages/payment/PaymentScreen'
import VietQRScreen from '../../pages/payment/VietQRScreen'
import RatingScreen from '../../pages/rating/RatingScreen'

const Stack = createNativeStackNavigator()

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMap" component={HomeMapPickupScreen} />
      <Stack.Screen name="Destination" component={DestinationScreen} />
      <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
      <Stack.Screen name="Searching" component={SearchingDriverScreen} />
      <Stack.Screen name="Tracking" component={RideTrackingScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="VietQR" component={VietQRScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
    </Stack.Navigator>
  )
}
