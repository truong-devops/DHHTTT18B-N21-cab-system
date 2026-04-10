import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
};

export const InputField: React.FC<Props> = ({ label, value, onChangeText, placeholder, keyboardType }) => {
  const palette = useAppPalette();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: palette.muted }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        keyboardType={keyboardType}
        accessibilityLabel={label || placeholder || 'Ô nhập liệu'}
        style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    ...typography.body
  }
});
