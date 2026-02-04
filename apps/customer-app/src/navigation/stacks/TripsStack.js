import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import RideHistoryScreen from '../../pages/trips/RideHistoryScreen'
import TripDetailScreen from '../../pages/trips/TripDetailScreen'

const Stack = createNativeStackNavigator()

export default function TripsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
    </Stack.Navigator>
  )
}
