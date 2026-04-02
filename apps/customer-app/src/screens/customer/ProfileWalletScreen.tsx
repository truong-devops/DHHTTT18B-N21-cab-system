import React from 'react'
import { StyleSheet, Text, View, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Card } from '../../components/common/Card'
import { OutlineButton } from '../../components/common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'

const primary = '#FF5A1F'
const primaryDark = '#FF3B1D'
const sectionBg = '#F9F4F2'

type ItemProps = { icon: string; title: string; tag?: string }

const ItemRow: React.FC<ItemProps> = ({ icon, title, tag }) => (
  <View style={styles.itemRow}>
    <Text style={styles.itemIcon}>{icon}</Text>
    <Text style={styles.itemTitle}>{title}</Text>
    {tag ? <Text style={styles.tag}>{tag}</Text> : null}
    <Text style={styles.chevron}>›</Text>
  </View>
)

const ProfileWalletScreen = () => {
  const { user, logout } = useCustomerStore()

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Header */}
        <View style={styles.headerWrap}>
          <LinearGradient colors={[primary, primaryDark]} style={styles.headerGradient}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'K').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{user?.name || 'Khách'}</Text>
            <Text style={styles.sub}>
              ★ 4.9 · {user?.phone || '090x xxx xxx'}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Thành viên VIP</Text>
            </View>
            <View style={styles.editBtn}>
              <Text style={styles.editIcon}>✎</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Group 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài chính & quản lý</Text>
          <Card style={styles.card}>
            <ItemRow icon="📊" title="Quản lý chi tiêu" />
            <View style={styles.divider} />
            <ItemRow icon="🧭" title="Kế hoạch di chuyển" />
            <View style={styles.divider} />
            <ItemRow icon="💼" title="Ví trả sau" tag="Mới" />
            <View style={styles.divider} />
            <ItemRow icon="💸" title="Vay tiền mặt" />
            <View style={styles.divider} />
            <ItemRow icon="🔗" title="Liên kết tài khoản" />
          </Card>
        </View>

        {/* Group 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dịch vụ & ưu đãi</Text>
          <Card style={styles.card}>
            <ItemRow icon="⚙️" title="Cài đặt chuyến đi" />
            <View style={styles.divider} />
            <ItemRow icon="🛡️" title="Bảo hiểm" />
            <View style={styles.divider} />
            <ItemRow icon="🎫" title="Khuyến mại" />
            <View style={styles.divider} />
            <ItemRow icon="📉" title="Gói tiết kiệm" />
            <View style={styles.divider} />
            <ItemRow icon="🎁" title="Giới thiệu & Nhận ưu đãi" />
            <View style={styles.divider} />
            <ItemRow icon="💳" title="Thanh toán" />
            <View style={styles.divider} />
            <ItemRow icon="🏢" title="Mở tài khoản Doanh nghiệp" tag="Mới" />
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <OutlineButton title="Đăng xuất" onPress={logout} />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: sectionBg },
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerGradient: {
    borderRadius: 20,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF'
  },
  avatarText: { ...typography.h2, color: '#FFF', fontSize: 32 },
  name: { ...typography.title, color: '#FFF', marginTop: spacing.sm },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.9)' },
  badge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  badgeText: { ...typography.body, color: '#FFF', fontWeight: '700' },
  editBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  editIcon: { ...typography.body, color: primary },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { ...typography.h2, color: colors.text },
  card: { paddingVertical: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  itemIcon: { fontSize: 18, width: 28 },
  itemTitle: { ...typography.body, color: colors.text, flex: 1, marginLeft: spacing.xs },
  tag: {
    backgroundColor: primary,
    color: '#FFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    marginRight: spacing.sm
  },
  chevron: { ...typography.body, color: colors.muted },
  divider: { height: 1, backgroundColor: '#EFEFEF', marginLeft: spacing.md },
  secondaryBg: { backgroundColor: sectionBg }
})

export default ProfileWalletScreen
