import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { customerMockApi } from '../../services/mockApi'
import type { RideOption } from '../../mock/data'
import { RideOptionCard } from '../../components/customer/RideOptionCard'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { useToast } from '../../hooks/useToast'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

const RideOptionsScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'RideOptions'>>()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { chooseOption, selectedOption } = useCustomerStore()
  const [options, setOptions] = useState<RideOption[]>([])
  const [loading, setLoading] = useState(true)
  const { push } = useToast()

  useEffect(() => {
    customerMockApi
      .getRideOptions(route.params.pickup, route.params.destination)
      .then((result) => setOptions(result))
      .catch((err) => push(err?.message || 'Cannot load ride options', 'danger'))
      .finally(() => setLoading(false))
  }, [route.params.destination, route.params.pickup, push])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ride Options & Pricing</Text>
      {loading ? <ActivityIndicator color={colors.brand600} /> : null}
      {options.map((option) => (
        <RideOptionCard
          key={option.id}
          option={option}
          selected={selectedOption?.id === option.id}
          onPress={() => chooseOption(option)}
        />
      ))}
      <PrimaryButton
        title="Find Driver"
        onPress={() => {
          if (!selectedOption) {
            push('Please select one option', 'danger')
            return
          }
          navigation.navigate('SearchingDriver', route.params)
        }}
      />
      {/* TODO: Use quote id snapshot from Pricing Service to keep booking price consistent */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text }
})

export default RideOptionsScreen
