import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SearchInput } from '../../components/common/SearchInput';
import { colors, spacing, typography } from '../../theme/tokens';
import { destinations, destinationPoints } from '../../mock/data';
import { useCustomerStore } from '../../store/customerStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { PlaceList } from '../../components/customer/PlaceList';

const pickup = 'Vị trí hiện tại';

const DestinationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { setDestination } = useCustomerStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const keyword = query.toLowerCase();
    return destinationPoints
      .filter((item) => item.label.toLowerCase().includes(keyword))
      .map((item) => ({ label: item.label, subtitle: 'Gợi ý', icon: '📍' }));
  }, [query]);

  const recent = useMemo(() => destinations.slice(0, 3).map((label) => ({ label, subtitle: 'Gần đây', icon: '🕓' })), []);

  const combined = [...filtered, ...recent.filter((r) => !filtered.find((f) => f.label === r.label))];

  const handleSelect = (value: string) => {
    setDestination(value);
    navigation.navigate('RideOptions', { pickup, destination: value });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chọn điểm đến</Text>
      <SearchInput value={query} onChangeText={setQuery} placeholder="Tìm điểm đến" />
      <PlaceList data={combined} onSelect={handleSelect} />
      {/* TODO: Replace with Places API + recent destinations endpoint */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text }
});

export default DestinationScreen;
