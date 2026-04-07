import React, { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = {
  value: string;
  length?: number;
  onChange: (next: string) => void;
};

export const OTPInput: React.FC<Props> = ({ value, length = 6, onChange }) => {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = value.split('').slice(0, length);

  useEffect(() => {
    if (value.length > length) {
      onChange(value.slice(0, length));
    }
  }, [value, length, onChange]);

  const handleChange = (char: string, index: number) => {
    const chars = value.split('');
    chars[index] = char.replace(/\s/g, '').slice(-1);
    const nextValue = chars.join('').slice(0, length);
    onChange(nextValue);
    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, idx) => (
        <TextInput
          key={idx}
          ref={(node) => {
            inputs.current[idx] = node;
          }}
          value={digits[idx] || ''}
          keyboardType="number-pad"
          maxLength={1}
          style={[styles.box, digits[idx] ? styles.boxFilled : null]}
          onChangeText={(text) => handleChange(text, idx)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
          returnKeyType="next"
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    textAlign: 'center',
    ...typography.h3,
    color: colors.text,
    backgroundColor: colors.card
  },
  boxFilled: { borderColor: colors.brand600 }
});
