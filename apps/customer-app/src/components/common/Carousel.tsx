import React, { useMemo, useRef } from 'react'
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Slide = {
  title: string
  subtitle?: string
}

type Props = {
  slides: Slide[]
  activeIndex: number
  onIndexChange?: (index: number) => void
}

const { width } = Dimensions.get('window')

export const Carousel: React.FC<Props> = ({ slides, activeIndex, onIndexChange }) => {
  const scrollRef = useRef<ScrollView>(null)
  const safeSlides = useMemo(() => slides.filter((s) => s.title), [slides])

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    if (nextIndex !== activeIndex) {
      onIndexChange?.(nextIndex)
    }
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={styles.scrollContent}
      >
        {safeSlides.map((slide, index) => (
          <View key={slide.title + index} style={[styles.slide, { width }]}>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            {slide.subtitle ? <Text style={styles.slideSubtitle}>{slide.subtitle}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {safeSlides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : null,
              index === activeIndex ? { width: 24 } : null
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center' },
  slide: { paddingHorizontal: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  slideTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  slideSubtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: '80%'
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, gap: spacing.xs },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 999,
    backgroundColor: colors.border
  },
  dotActive: { backgroundColor: colors.brand600 }
})
