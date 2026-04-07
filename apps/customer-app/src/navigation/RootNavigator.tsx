import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCustomerStore } from '../store/customerStore';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import { View } from 'react-native';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { bootstrapped, authenticated } = useCustomerStore();

  if (!bootstrapped) {
    return <View style={{ flex: 1, backgroundColor: '#FFF' }} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authenticated ? <Stack.Screen name="Main" component={MainStack} /> : <Stack.Screen name="Auth" component={AuthStack} />}
    </Stack.Navigator>
  );
};

export default RootNavigator;
