import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Tabs from './Tabs'
import IncomingRideScreen from '../screens/driver/IncomingRideScreen'
import PickupScreen from '../screens/driver/PickupScreen'
import InProgressScreen from '../screens/driver/InProgressScreen'
import CompletedScreen from '../screens/driver/CompletedScreen'
import TripDetailScreen from '../screens/driver/TripDetailScreen'
import ApiTesterScreen from '../screens/debug/ApiTesterScreen'

export type MainStackParamList = {
  Tabs: undefined
  IncomingRide: { ride?: any } | undefined
  Pickup: { rideId?: string } | undefined
  InProgress: { rideId?: string } | undefined
  Completed: { rideId?: string } | undefined
  TripDetail: { tripId: string }
  ApiTester: undefined
}

const Stack = createNativeStackNavigator<MainStackParamList>()

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={Tabs} />
    <Stack.Screen name="IncomingRide" component={IncomingRideScreen} options={{ presentation: 'transparentModal' }} />
    <Stack.Screen name="Pickup" component={PickupScreen} />
    <Stack.Screen name="InProgress" component={InProgressScreen} />
    <Stack.Screen name="Completed" component={CompletedScreen} />
    <Stack.Screen name="TripDetail" component={TripDetailScreen} />
    <Stack.Screen name="ApiTester" component={ApiTesterScreen} />
  </Stack.Navigator>
)

export default MainStack
