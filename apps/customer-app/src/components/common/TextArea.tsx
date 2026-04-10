import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  minHeight?: number;
};

export const TextArea: React.FC<Props> = ({ value, placeholder, onChangeText, minHeight = 120 }) => {
  const palette = useAppPalette();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      style={[styles.input, { minHeight, borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
      multiline
      textAlignVertical="top"
      accessibilityLabel={placeholder || 'Ô nhập nội dung'}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.md,
    ...typography.body
  }
});
