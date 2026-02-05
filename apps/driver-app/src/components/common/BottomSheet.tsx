import React from 'react'
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { colors, radius, spacing } from '../../theme/tokens'

const { height } = Dimensions.get('window')

type Props = {
  visible: boolean
  snapPoints?: number[]
  snapIndex?: number
  onClose: () => void
  scrollable?: boolean
  children: React.ReactNode
}

export const BottomSheet: React.FC<Props> = ({
  visible,
  snapPoints = [0.35, 0.7],
  snapIndex = 0,
  onClose,
  scrollable = true,
  children
}) => {
  const targetHeight = height * (snapPoints[snapIndex] || snapPoints[0])
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { height: targetHeight }]}>
          <View style={styles.handle} />
          {scrollable ? (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.15)'
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderColor: colors.border,
    borderWidth: 1
  },
  handle: {
    width: 50,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg
  }
})
