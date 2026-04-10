import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '../../theme/tokens';

type Props = {
  value: number;
  max?: number;
  onChange: (value: number) => void;
};

export const RatingStars: React.FC<Props> = ({ value, max = 5, onChange }) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1;
        const active = starValue <= value;
        return (
          <Pressable key={starValue} onPress={() => onChange(starValue)} hitSlop={6}>
            <MaterialIcons name={active ? 'star' : 'star-border'} size={34} color={active ? '#F59E0B' : '#D0D5DD'} />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm }
});
