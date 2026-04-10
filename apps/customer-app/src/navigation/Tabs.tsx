import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeMapScreen from '../screens/customer/HomeMapScreen';
import HistoryScreen from '../screens/customer/HistoryScreen';
import ProfileWalletScreen from '../screens/customer/ProfileWalletScreen';
import WalletScreen from '../screens/customer/WalletScreen';
import SettingsScreen from '../screens/customer/SettingsScreen';
import { colors } from '../theme/tokens';
import { IconSymbol } from '../components/ui/icon-symbol';

export type TabParamList = {
  Home: undefined;
  History: undefined;
  Wallet: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const Tabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600'
        }
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeMapScreen}
        options={{
          title: 'Trang chủ',
          tabBarLabel: 'Trang chủ',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Lịch sử',
          tabBarLabel: 'Lịch sử',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clock.fill" color={color} />
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: 'Ví',
          tabBarLabel: 'Ví',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="creditcard.fill" color={color} />
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileWalletScreen}
        options={{
          title: 'Tài khoản',
          tabBarLabel: 'Tài khoản',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt',
          tabBarLabel: 'Cài đặt',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

export default Tabs;
