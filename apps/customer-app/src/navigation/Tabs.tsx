import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeMapScreen from '../screens/customer/HomeMapScreen'
import HistoryScreen from '../screens/customer/HistoryScreen'
import ProfileWalletScreen from '../screens/customer/ProfileWalletScreen'
import WalletScreen from '../screens/customer/WalletScreen'
import PromoScreen from '../screens/customer/PromoScreen'
import { colors } from '../theme/tokens'

export type TabParamList = {
  Home: undefined
  History: undefined
  Wallet: undefined
  Promo: undefined
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
      <Tab.Screen
        name="Home"
        component={HomeMapScreen}
        options={{ title: 'Trang chủ', tabBarLabel: 'Trang chủ' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Lịch sử', tabBarLabel: 'Lịch sử' }}
      />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Ví', tabBarLabel: 'Ví' }} />
      <Tab.Screen name="Promo" component={PromoScreen} options={{ title: 'Ưu đãi', tabBarLabel: 'Ưu đãi' }} />
      <Tab.Screen
        name="Profile"
        component={ProfileWalletScreen}
        options={{ title: 'Tài khoản', tabBarLabel: 'Tài khoản' }}
      />
    </Tab.Navigator>
  )
}

export default Tabs
