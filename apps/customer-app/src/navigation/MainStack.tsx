import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Tabs, { type TabParamList } from './Tabs';
import DestinationScreen from '../screens/customer/DestinationScreen';
import RideOptionsScreen from '../screens/customer/RideOptionsScreen';
import SearchingDriverScreen from '../screens/customer/SearchingDriverScreen';
import RideTrackingScreen from '../screens/customer/RideTrackingScreen';
import PaymentScreen from '../screens/customer/PaymentScreen';
import RatingScreen from '../screens/customer/RatingScreen';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Destination: undefined;
  RideOptions: { pickup: string; destination: string };
  SearchingDriver: { pickup: string; destination: string };
  RideTracking: undefined;
  Payment: undefined;
  Rating: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Destination" component={DestinationScreen} />
      <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
      <Stack.Screen name="SearchingDriver" component={SearchingDriverScreen} />
      <Stack.Screen name="RideTracking" component={RideTrackingScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
    </Stack.Navigator>
  );
};

export default MainStack;
