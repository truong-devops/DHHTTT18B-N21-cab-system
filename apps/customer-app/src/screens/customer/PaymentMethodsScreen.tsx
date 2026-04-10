import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card } from '../../components/common/Card';
import { OutlineButton } from '../../components/common/OutlineButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  upsertPaymentMethod,
  type PaymentMethodItem,
  type PaymentMethodType
} from '../../lib/settings-storage';
import { StateView } from '../../components/common/StateView';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

type FormState = {
  id?: string;
  type: PaymentMethodType;
  label: string;
  details: string;
  isDefault: boolean;
};

const emptyForm: FormState = {
  type: 'CARD',
  label: '',
  details: '',
  isDefault: false
};

const typeOptions: Array<{ label: string; value: PaymentMethodType }> = [
  { label: 'Tiền mặt', value: 'CASH' },
  { label: 'Thẻ', value: 'CARD' },
  { label: 'Ví', value: 'WALLET' },
  { label: 'VietQR', value: 'VIETQR' }
];

function methodTypeLabel(type: PaymentMethodType) {
  return typeOptions.find((item) => item.value === type)?.label || type;
}

const PaymentMethodsScreen = () => {
  const navigation = useNavigation();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

  const [items, setItems] = useState<PaymentMethodItem[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMethods = useMemo(() => items.length > 0, [items.length]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listPaymentMethods();
      setItems(next);
    } catch {
      setError('Không tải được phương thức thanh toán.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const openCreate = () => {
    setForm(emptyForm);
    setEditorVisible(true);
  };

  const openEdit = (item: PaymentMethodItem) => {
    setForm({
      id: item.id,
      type: item.type,
      label: item.label,
      details: item.details || '',
      isDefault: item.isDefault
    });
    setEditorVisible(true);
  };

  const onSubmit = async () => {
    try {
      setSaving(true);
      const next = await upsertPaymentMethod(form);
      setItems(next);
      setEditorVisible(false);
      setForm(emptyForm);
    } catch (submitError: any) {
      Alert.alert('Lỗi', submitError?.message || 'Không lưu được phương thức thanh toán');
    } finally {
      setSaving(false);
    }
  };

  const onSetDefault = async (item: PaymentMethodItem) => {
    const next = await setDefaultPaymentMethod(item.id);
    setItems(next);
  };

  const onDelete = (item: PaymentMethodItem) => {
    Alert.alert('Xóa phương thức', `Bạn có chắc muốn xóa "${item.label}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void removePaymentMethod(item.id).then(setItems);
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}> 
      <View style={[styles.header, { paddingHorizontal: metrics.horizontalPadding }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Text style={[styles.backText, { color: palette.brand700 }]}>{'<'} Quay lại</Text>
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Phương thức thanh toán</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: metrics.horizontalPadding }]}> 
        {loading ? (
          <View style={styles.skeletonList}>
            <SkeletonBlock height={84} />
            <SkeletonBlock height={84} />
          </View>
        ) : error ? (
          <StateView type="error" title="Không tải được phương thức" message={error} actionLabel="Thử lại" onAction={() => void refresh()} />
        ) : !hasMethods ? (
          <StateView type="empty" title="Chưa có phương thức thanh toán" message="Hãy thêm mới để sử dụng khi đặt xe." />
        ) : (
          items.map((item) => (
            <Card key={item.id} style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <View style={styles.methodLeft}>
                  <View style={styles.iconWrap}>
                    <IconSymbol name="creditcard.fill" size={16} color={colors.brand700} />
                  </View>
                  <View>
                    <Text style={[styles.methodLabel, { color: palette.text }]}>{item.label}</Text>
                    <Text style={[styles.methodSub, { color: palette.muted }]}>
                      {methodTypeLabel(item.type)}
                      {item.details ? ` - ${item.details}` : ''}
                    </Text>
                  </View>
                </View>
                {item.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Mặc định</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.actionsRow}>
                <OutlineButton title="Đặt mặc định" onPress={() => onSetDefault(item)} style={styles.actionBtn} disabled={item.isDefault} />
                <OutlineButton title="Sửa" onPress={() => openEdit(item)} style={styles.actionBtn} />
                <OutlineButton
                  title="Xóa"
                  onPress={() => onDelete(item)}
                  style={styles.actionBtn}
                  textStyle={{ color: colors.danger }}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.border, paddingHorizontal: metrics.horizontalPadding }]}> 
        <PrimaryButton title="Thêm phương thức" onPress={openCreate} />
      </View>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalPanel, { backgroundColor: palette.surface }]}> 
            <Text style={[styles.modalTitle, { color: palette.text }]}>{form.id ? 'Cập nhật phương thức' : 'Thêm phương thức'}</Text>

            <View style={styles.formBlock}>
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Loại</Text>
              <View style={styles.typeRow}>
                {typeOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setForm((prev) => ({ ...prev, type: option.value }))}
                    style={[
                      styles.typeChip,
                      { borderColor: palette.border },
                      form.type === option.value ? styles.typeChipActive : null
                    ]}
                  >
                    <Text style={[styles.typeChipText, { color: palette.text }, form.type === option.value ? styles.typeChipTextActive : null]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formBlock}>
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Tên hiển thị</Text>
              <TextInput
                value={form.label}
                onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
                placeholder="Ví dụ: Visa của tôi"
                placeholderTextColor={palette.muted}
                style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
              />
            </View>

            <View style={styles.formBlock}>
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Mô tả ngắn</Text>
              <TextInput
                value={form.details}
                onChangeText={(value) => setForm((prev) => ({ ...prev, details: value }))}
                placeholder="Ví dụ: **** 1234"
                placeholderTextColor={palette.muted}
                style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
              />
            </View>

            <Pressable style={styles.defaultToggle} onPress={() => setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))}>
              <View style={[styles.checkbox, { borderColor: palette.border }, form.isDefault ? styles.checkboxChecked : null]}>
                {form.isDefault ? <Text style={styles.checkboxMark}>x</Text> : null}
              </View>
              <Text style={[styles.defaultToggleText, { color: palette.text }]}>Đặt làm mặc định</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <OutlineButton title="Hủy" onPress={() => setEditorVisible(false)} />
              <PrimaryButton title={saving ? 'Đang lưu...' : 'Lưu'} onPress={onSubmit} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.body, fontWeight: '600' },
  title: { ...typography.title },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm
  },
  skeletonList: { gap: spacing.sm },
  methodCard: { gap: spacing.sm },
  methodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,31,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  methodLabel: { ...typography.h3 },
  methodSub: { ...typography.caption },
  defaultBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: '#E7F7EC'
  },
  defaultText: { ...typography.caption, color: colors.success, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: { flex: 1, minHeight: 40 },
  footer: {
    borderTopWidth: 1,
    paddingVertical: spacing.md
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'flex-end'
  },
  modalPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm
  },
  modalTitle: { ...typography.h2 },
  formBlock: { gap: spacing.xs },
  inputLabel: { ...typography.caption, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  typeChipActive: {
    borderColor: colors.brand700,
    backgroundColor: 'rgba(255,90,31,0.12)'
  },
  typeChipText: { ...typography.caption },
  typeChipTextActive: { color: colors.brand700, fontWeight: '700' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: { borderColor: colors.brand700, backgroundColor: colors.brand700 },
  checkboxMark: { color: colors.white, fontSize: 11, fontWeight: '700' },
  defaultToggleText: { ...typography.body },
  modalActions: { gap: spacing.sm }
});

export default PaymentMethodsScreen;
