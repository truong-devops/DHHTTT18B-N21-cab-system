import React, { useState } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, View } from 'react-native'
import { colors, spacing } from '../../theme/tokens'

type Props = {
  collapsedHeight?: number
  children: React.ReactNode
}

export const BottomSheet: React.FC<Props> = ({ collapsedHeight = 140, children }) => {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((prev) => !prev)
  }

  return (
    <Pressable style={[styles.container, expanded ? styles.expanded : { height: collapsedHeight }]} onPress={toggle}>
      <View style={styles.drag} />
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 16,
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  expanded: {
    top: Platform.select({ ios: spacing.xl, android: spacing.xl, default: spacing.xl })
  },
  drag: {
    width: 60,
    height: 6,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: colors.border,
    marginBottom: spacing.sm
  }
})
