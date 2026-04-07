import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

type ToastItem = {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'danger';
};

type ToastContextValue = {
  push: (message: string, variant?: ToastItem['variant']) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastItem['variant'] = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 2300);
    },
    [remove]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.stack}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.toast, item.variant === 'success' ? styles.success : null, item.variant === 'danger' ? styles.danger : null]}
          >
            <Text style={styles.text}>{item.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    gap: spacing.sm
  },
  toast: {
    backgroundColor: colors.info,
    borderRadius: 10,
    padding: spacing.md
  },
  success: {
    backgroundColor: colors.success
  },
  danger: {
    backgroundColor: colors.danger
  },
  text: {
    ...typography.body,
    color: '#FFF'
  }
});
