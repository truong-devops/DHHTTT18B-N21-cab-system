import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import SplashScreen from '../screens/auth/SplashScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import OtpScreen from '../screens/auth/OtpScreen'
import KycStatusScreen from '../screens/auth/KycStatusScreen'

export type AuthStackParamList = {
  Splash: undefined
  Login: undefined
  Otp: { identifier: string }
  Kyc: undefined
}

const Stack = createNativeStackNavigator<AuthStackParamList>()

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Otp" component={OtpScreen} />
    <Stack.Screen name="Kyc" component={KycStatusScreen} />
  </Stack.Navigator>
)

export default AuthStack
