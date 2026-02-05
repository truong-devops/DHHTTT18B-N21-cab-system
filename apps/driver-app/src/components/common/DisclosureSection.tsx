import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

export const DisclosureSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children
}) => {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.container}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.icon}>{open ? '-' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md
  },
  title: { ...typography.body, fontWeight: '600', color: colors.text },
  icon: { ...typography.body, color: colors.muted },
  body: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }
})
