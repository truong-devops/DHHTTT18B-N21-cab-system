import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import KycStatusScreen from '../screens/auth/KycStatusScreen'
import AuthStack from './AuthStack'
import MainStack from './MainStack'
import MissingConfigScreen from '../screens/debug/MissingConfigScreen'
import { getBaseUrl } from '../services/api'
import { View } from 'react-native'

export type RootStackParamList = {
  Auth: undefined
  Main: undefined
  Kyc: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const RootNavigator = () => {
  const { accessToken, needsKyc, bootstrapped } = useAuthStore()
  const baseUrl = getBaseUrl()

  if (!baseUrl) {
    return <MissingConfigScreen />
  }

  if (!bootstrapped) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!accessToken ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : needsKyc ? (
        <Stack.Screen name="Kyc" component={KycStatusScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainStack} />
      )}
    </Stack.Navigator>
  )
}

export default RootNavigator
