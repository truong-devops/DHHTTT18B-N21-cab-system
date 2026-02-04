import React, { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import PaymentMethodPicker from '../../components/payment/PaymentMethodPicker'
import FareSummaryCard from '../../components/payment/FareSummaryCard'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import { paymentMethods } from '../../utils/constants'
import { createPayment } from '../../services/paymentApi'
import { useToast } from '../../hooks/useToast'

export default function PaymentScreen({ navigation, route }) {
  const [method, setMethod] = useState('CASH')
  const { show } = useToast()
  const rideId = route?.params?.rideId || 'ride_test_1'

  const handlePay = async () => {
    try {
      await createPayment({
        rideId,
        amount: '100000',
        currency: 'VND',
        method
      })
      if (method === 'VIETQR') {
        navigation.navigate('VietQR', { rideId })
      } else {
        navigation.navigate('Rating')
      }
    } catch (e) {
      show(e.message || 'Thanh toán thất bại', 'danger')
    }
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Thanh toán</Text>
      <FareSummaryCard total="32.000 VND" />
      <Text style={styles.section}>Chọn phương thức</Text>
      <PaymentMethodPicker methods={paymentMethods} value={method} onChange={setMethod} />
      <PrimaryButton title="Thanh toán" onPress={handlePay} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.md },
  section: { color: colors.text, ...typography.h2, marginTop: spacing.lg, marginBottom: spacing.sm }
})
