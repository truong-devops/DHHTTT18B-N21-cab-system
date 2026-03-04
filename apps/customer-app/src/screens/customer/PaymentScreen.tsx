import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { OutlineButton } from '../../components/common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { paymentMethods } from '../../mock/data'
import { formatVnd } from '../../utils/format'
import { useToast } from '../../hooks/useToast'

const PaymentScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { activeRide, completeRidePayment } = useCustomerStore()
  const [method, setMethod] = useState(paymentMethods[0])
  const [loading, setLoading] = useState(false)
  const { push } = useToast()

  const handlePay = async () => {
    try {
      setLoading(true)
      await completeRidePayment(method)
      navigation.replace('Rating')
    } catch (err: any) {
      push(err?.message || 'Thanh toán thất bại', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thanh toán</Text>
      <Card>
        <Text style={styles.label}>Tổng cước phí</Text>
        <Text style={styles.amount}>{formatVnd(activeRide?.option.price || 0)}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Phương thức thanh toán</Text>
        {paymentMethods.map((item) => (
          <View key={item}>
            {item === method ? (
              <PrimaryButton title={`${item} đã chọn`} onPress={() => setMethod(item)} />
            ) : (
              <OutlineButton title={item} onPress={() => setMethod(item)} />
            )}
          </View>
        ))}
      </Card>
      <PrimaryButton title={loading ? 'Đang xử lý...' : 'Thanh toán'} onPress={handlePay} disabled={loading} />
      {/* TODO: Add VietQR/card redirect flow once Payment Service integration is enabled */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  label: { ...typography.body, color: colors.muted },
  amount: { ...typography.title, color: colors.brand700 }
})

export default PaymentScreen
