import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { Chip } from '../../components/common/Chip'
import { DisclosureSection } from '../../components/common/DisclosureSection'
import { colors, spacing, typography } from '../../theme/tokens'
import { useAuthStore } from '../../store/authStore'

const KycStatusScreen = () => {
  const { completeKyc } = useAuthStore()
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xác minh KYC</Text>
      <Text style={styles.subtitle}>Hoàn tất để bật chế độ Online</Text>

      <Card style={styles.stepCard}>
        <Text style={styles.stepTitle}>Bước 1: CCCD/CMND</Text>
        <Chip label="Pending" variant="outline" />
      </Card>
      <Card style={styles.stepCard}>
        <Text style={styles.stepTitle}>Bước 2: Giấy phép lái xe</Text>
        <Chip label="Approved" variant="success" />
      </Card>
      <Card style={styles.stepCard}>
        <Text style={styles.stepTitle}>Bước 3: Ảnh chân dung</Text>
        <Chip label="Rejected" variant="danger" />
      </Card>

      <DisclosureSection title="Thông tin nâng cao">
        <Text style={styles.disclosureText}>Biển số, hãng xe, khu vực hoạt động.</Text>
      </DisclosureSection>

      <PrimaryButton title="Vào ứng dụng" onPress={completeKyc} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.muted, marginBottom: spacing.lg },
  stepCard: { marginBottom: spacing.md },
  stepTitle: { ...typography.body, marginBottom: spacing.sm },
  disclosureText: { ...typography.body, color: colors.muted }
})

export default KycStatusScreen
