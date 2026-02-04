import React from 'react'
import useAuth from '../hooks/useAuth'
import AuthStack from './stacks/AuthStack'
import MainTabs from './tabs/MainTabs'

export default function RootNavigator() {
  const { token } = useAuth()
  return token ? <MainTabs /> : <AuthStack />
}
