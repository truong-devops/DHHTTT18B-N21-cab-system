import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/store/authStore'
import { ToastProvider } from './src/hooks/useToast'
import { LogProvider } from './src/store/logStore'

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LogProvider>
          <ToastProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </ToastProvider>
        </LogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
