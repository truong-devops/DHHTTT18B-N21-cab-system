import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeStack from '../stacks/HomeStack'
import TripsStack from '../stacks/TripsStack'
import ProfileStack from '../stacks/ProfileStack'
import NotificationsScreen from '../../pages/notifications/NotificationsScreen'

const Tab = createBottomTabNavigator()

export default function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Trips" component={TripsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  )
}
