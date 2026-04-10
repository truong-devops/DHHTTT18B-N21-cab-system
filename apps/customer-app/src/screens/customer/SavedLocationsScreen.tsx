import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card } from '../../components/common/Card';
import { OutlineButton } from '../../components/common/OutlineButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { colors, spacing, typography } from '../../theme/tokens';
import { listSavedLocations, removeSavedLocation, upsertSavedLocation, type SavedLocation } from '../../lib/settings-storage';
import { StateView } from '../../components/common/StateView';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

type FormState = {
  id?: string;
  label: string;
  address: string;
};

const emptyForm: FormState = { label: '', address: '' };

const SavedLocationsScreen = () => {
  const navigation = useNavigation();
  const metrics = useScreenMetrics();
  const palette = useAppPalette();

  const [items, setItems] = useState<SavedLocation[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listSavedLocations();
      setItems(next);
    } catch {
      setError('Không tải được danh sách địa điểm đã lưu.');
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

  const openEdit = (item: SavedLocation) => {
    setForm({ id: item.id, label: item.label, address: item.address });
    setEditorVisible(true);
  };

  const onSubmit = async () => {
    try {
      setSaving(true);
      const next = await upsertSavedLocation(form);
      setItems(next);
      setEditorVisible(false);
      setForm(emptyForm);
    } catch (submitError: any) {
      Alert.alert('Lỗi', submitError?.message || 'Không lưu được địa điểm');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (item: SavedLocation) => {
    Alert.alert('Xóa địa điểm', `Bạn có chắc muốn xóa "${item.label}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void removeSavedLocation(item.id).then(setItems);
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
        <Text style={[styles.title, { color: palette.text }]}>Địa điểm đã lưu</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: metrics.horizontalPadding }]}> 
        {loading ? (
          <View style={styles.skeletonList}>
            <SkeletonBlock height={84} />
            <SkeletonBlock height={84} />
          </View>
        ) : error ? (
          <StateView type="error" title="Không tải được danh sách" message={error} actionLabel="Thử lại" onAction={() => void refresh()} />
        ) : items.length === 0 ? (
          <StateView type="empty" title="Chưa có địa điểm nào" message="Hãy thêm Nhà, Cơ quan hoặc địa điểm thường dùng." />
        ) : (
          items.map((item) => (
            <Card key={item.id} style={styles.locationCard}>
              <View style={styles.locationRow}>
                <View style={styles.iconWrap}>
                  <IconSymbol name="pin.fill" size={16} color={colors.brand700} />
                </View>
                <View style={styles.locationBody}>
                  <Text style={[styles.locationLabel, { color: palette.text }]}>{item.label}</Text>
                  <Text style={[styles.locationAddress, { color: palette.muted }]}>{item.address}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
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
        <PrimaryButton title="Thêm địa điểm" onPress={openCreate} />
      </View>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalPanel, { backgroundColor: palette.surface }]}> 
            <Text style={[styles.modalTitle, { color: palette.text }]}>{form.id ? 'Cập nhật địa điểm' : 'Thêm địa điểm mới'}</Text>
            <View style={styles.formBlock}>
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Nhãn</Text>
              <TextInput
                value={form.label}
                onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
                placeholder="Ví dụ: Nhà, Cơ quan"
                placeholderTextColor={palette.muted}
                style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
              />
            </View>
            <View style={styles.formBlock}>
              <Text style={[styles.inputLabel, { color: palette.muted }]}>Địa chỉ</Text>
              <TextInput
                value={form.address}
                onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
                placeholder="Nhập địa chỉ đầy đủ"
                placeholderTextColor={palette.muted}
                style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
              />
            </View>
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
  locationCard: { gap: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,31,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationBody: { flex: 1, gap: spacing.xs },
  locationLabel: { ...typography.h3 },
  locationAddress: { ...typography.body },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },
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
  modalActions: { gap: spacing.sm }
});

export default SavedLocationsScreen;
