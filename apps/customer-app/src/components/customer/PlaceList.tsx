import React from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Place = {
  id?: string
  label: string
  subtitle?: string
  icon?: string
}

type Props = {
  data: Place[]
  onSelect: (label: string) => void
}

export const PlaceList: React.FC<Props> = ({ data, onSelect }) => {
  return (
    <FlatList
      data={data}
      keyExtractor={(item, idx) => item.id || item.label + idx}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => onSelect(item.label)}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconText}>{item.icon || '•'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.label}</Text>
            {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
          </View>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconText: { ...typography.body, color: colors.brand700 },
  title: { ...typography.body, color: colors.text },
  subtitle: { ...typography.caption, color: colors.muted }
})
