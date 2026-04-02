import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { colors, spacing, typography } from '../../theme/tokens'

const promos = [
  { id: 'p1', title: 'Giảm 20% chuyến tiếp theo', desc: 'Áp dụng mọi khung giờ', color: '#FFF4F1', icon: '🔥' },
  { id: 'p2', title: 'Miễn phí 1km đầu', desc: 'Xe máy giờ thấp điểm', color: '#F4F7FF', icon: '🛵' },
  { id: 'p3', title: 'Tặng 50K cho bạn mới', desc: 'Nhập mã WELCOME50', color: '#FFF8E6', icon: '🎁' }
]

const PromoScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ưu đãi</Text>
      {promos.map((p) => (
        <Card key={p.id} style={[styles.card, { backgroundColor: p.color }]}>
          <View style={styles.row}>
            <Text style={styles.icon}>{p.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.desc}>{p.desc}</Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  icon: { fontSize: 22 },
  cardTitle: { ...typography.h2, color: colors.text },
  desc: { ...typography.body, color: colors.muted }
})

export default PromoScreen
