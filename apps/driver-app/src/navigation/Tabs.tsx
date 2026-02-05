import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import DriverHomeScreen from '../screens/driver/DriverHomeScreen'
import HistoryScreen from '../screens/driver/HistoryScreen'
import EarningsScreen from '../screens/driver/EarningsScreen'
import ProfileScreen from '../screens/driver/ProfileScreen'
import { colors } from '../theme/tokens'

export type TabParamList = {
  Home: undefined
  History: undefined
  Earnings: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<TabParamList>()

const Tabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brand600,
      tabBarStyle: { borderTopColor: colors.border }
    }}
  >
    <Tab.Screen name="Home" component={DriverHomeScreen} />
    <Tab.Screen name="History" component={HistoryScreen} />
    <Tab.Screen name="Earnings" component={EarningsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
)

export default Tabs
