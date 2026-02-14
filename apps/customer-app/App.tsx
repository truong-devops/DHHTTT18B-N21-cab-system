import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { ToastProvider } from './src/hooks/useToast'
import { CustomerProvider } from './src/store/customerStore'

export default function App() {
  return (
    <SafeAreaProvider>
      <CustomerProvider>
        <ToastProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </ToastProvider>
      </CustomerProvider>
    </SafeAreaProvider>
  )
}
