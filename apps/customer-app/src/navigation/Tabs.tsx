import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeMapScreen from '../screens/customer/HomeMapScreen'
import HistoryScreen from '../screens/customer/HistoryScreen'
import ProfileWalletScreen from '../screens/customer/ProfileWalletScreen'
import { colors } from '../theme/tokens'

export type TabParamList = {
  Home: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<TabParamList>()

const Tabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarStyle: { borderTopColor: colors.border }
      }}
    >
      <Tab.Screen name="Home" component={HomeMapScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileWalletScreen} />
    </Tab.Navigator>
  )
}

export default Tabs
