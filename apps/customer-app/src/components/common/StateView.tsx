import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { OutlineButton } from './OutlineButton';
import { useAppPalette } from '../../theme/palette';

type Props = {
  type: 'loading' | 'empty' | 'error';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const StateView: React.FC<Props> = ({ type, title, message, actionLabel, onAction }) => {
  const palette = useAppPalette();

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {type === 'loading' ? <ActivityIndicator color={palette.brand600} /> : null}
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: palette.muted }]}>{message}</Text> : null}
      {actionLabel && onAction ? <OutlineButton title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  title: {
    ...typography.h3,
    textAlign: 'center'
  },
  message: {
    ...typography.body,
    textAlign: 'center'
  },
  action: {
    minWidth: 140
  }
});
