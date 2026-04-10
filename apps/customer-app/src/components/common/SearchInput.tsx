import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export const SearchInput: React.FC<Props> = ({ value, onChangeText, placeholder }) => {
  const palette = useAppPalette();

  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Tìm kiếm'}
        placeholderTextColor={palette.muted}
        style={[styles.input, { color: palette.text }]}
        accessibilityLabel={placeholder || 'Tìm kiếm'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1
  },
  input: { ...typography.body }
});
