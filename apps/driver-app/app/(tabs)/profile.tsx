import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type Profile = Awaited<ReturnType<typeof mockApi.getDriverProfile>>;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    mockApi.getDriverProfile().then(setProfile);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Hồ sơ</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{profile?.name ?? '--'}</Text>
          <Text style={styles.phone}>{profile?.phone ?? '--'}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Đánh giá</Text>
            <Text style={styles.value}>{profile?.rating ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Trạng thái</Text>
            <Text style={styles.value}>{profile?.online ? 'Đang trực tuyến' : 'Ngoại tuyến'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Phương tiện</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Xe</Text>
            <Text style={styles.value}>{profile?.vehicle ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Biển số</Text>
            <Text style={styles.value}>{profile?.plate ?? '--'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cài đặt nhanh</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Thông báo</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Bảo mật</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Trợ giúp</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  phone: {
    color: palette.muted,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    color: palette.muted,
  },
  value: {
    color: palette.text,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: palette.redSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipText: {
    color: palette.redDark,
    fontWeight: '600',
    fontSize: 12,
  },
});
