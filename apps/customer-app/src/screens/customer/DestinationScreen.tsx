import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { colors, spacing, typography } from '../../theme/tokens'
import { destinations } from '../../mock/data'
import { useCustomerStore } from '../../store/customerStore'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'

const pickup = 'Vị trí hiện tại'

const DestinationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { setDestination } = useCustomerStore()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => destinations.filter((item) => item.toLowerCase().includes(query.toLowerCase())),
    [query]
  )

  const handleSelect = (value: string) => {
    setDestination(value)
    navigation.navigate('RideOptions', { pickup, destination: value })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chọn điểm đến</Text>
      <InputField value={query} onChangeText={setQuery} placeholder="Tìm điểm đến" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <Pressable onPress={() => handleSelect(item)} style={styles.item}>
            <Text style={styles.text}>{item}</Text>
          </Pressable>
        )}
      />
      {/* TODO: Replace static suggestions with Places API + recent destinations endpoint */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  text: { ...typography.body, color: colors.text }
})

export default DestinationScreen
