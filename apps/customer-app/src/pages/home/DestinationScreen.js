import React, { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import InputField from '../../components/common/InputField'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'

export default function DestinationScreen({ navigation, route }) {
  const [destination, setDestination] = useState('')
  const pickup = route?.params?.pickup || { lat: 10.76, lng: 106.66 }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Chọn điểm đến</Text>
      <InputField value={destination} onChangeText={setDestination} placeholder="Nhập địa điểm" />
      <PrimaryButton
        title="Tiếp tục"
        onPress={() =>
          navigation.navigate('RideOptions', {
            pickup,
            dropoff: { lat: 10.78, lng: 106.68 },
            destinationLabel: destination || 'Điểm đến'
          })
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
