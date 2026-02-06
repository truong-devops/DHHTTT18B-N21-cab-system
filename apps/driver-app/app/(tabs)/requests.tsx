import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type Request = Awaited<ReturnType<typeof mockApi.getRideRequests>>[number];

const phases = ['Đang đến điểm đón', 'Đang đón khách', 'Đang di chuyển'];

export default function RequestsScreen() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'completed' | 'declined'>('pending');
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    mockApi.getRideRequests().then(setRequests);
  }, []);

  const activeRequest = requests[activeIndex];

  const ctaLabel = useMemo(() => {
    if (status === 'pending') return 'Nhận chuyến';
    if (status === 'accepted' && phaseIndex < phases.length - 1) return 'Cập nhật trạng thái';
    if (status === 'accepted') return 'Hoàn tất chuyến';
    if (status === 'completed') return 'Chuyến đã hoàn tất';
    return 'Yêu cầu tiếp theo';
  }, [status, phaseIndex]);

  const handleAccept = () => {
    setStatus('accepted');
    setPhaseIndex(0);
  };

  const handleAdvance = () => {
    if (status === 'pending') {
      handleAccept();
      return;
    }
    if (status === 'accepted' && phaseIndex < phases.length - 1) {
      setPhaseIndex((prev) => prev + 1);
      return;
    }
    if (status === 'accepted') {
      setStatus('completed');
      return;
    }
    if (status === 'completed' || status === 'declined') {
      setStatus('pending');
      setPhaseIndex(0);
      setActiveIndex((prev) => (prev + 1) % Math.max(requests.length, 1));
    }
  };

  const handleDecline = () => {
    setStatus('declined');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Chuyến nhận</Text>
        {!activeRequest ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Đang tải yêu cầu...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.eyebrow}>Yêu cầu mới</Text>
                <Text style={styles.requestTitle}>{activeRequest.title}</Text>
              </View>
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>
                  {activeRequest.price.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            </View>

            <View style={styles.requestRow}>
              <Text style={styles.label}>Khách</Text>
              <Text style={styles.value}>{activeRequest.passenger}</Text>
            </View>
            <View style={styles.requestRow}>
              <Text style={styles.label}>Loại chuyến</Text>
              <Text style={styles.value}>{activeRequest.category}</Text>
            </View>
            <View style={styles.requestRow}>
              <Text style={styles.label}>Quãng đường</Text>
              <Text style={styles.value}>{activeRequest.distanceKm} km • {activeRequest.durationMin} phút</Text>
            </View>
            <View style={styles.requestRow}>
              <Text style={styles.label}>Điểm đón</Text>
              <Text style={styles.value}>{activeRequest.pickup}</Text>
            </View>
            <View style={styles.requestRow}>
              <Text style={styles.label}>Điểm đến</Text>
              <Text style={styles.value}>{activeRequest.dropoff}</Text>
            </View>
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Ghi chú</Text>
              <Text style={styles.noteText}>{activeRequest.note}</Text>
            </View>

            {status === 'accepted' && (
              <View style={styles.phaseBox}>
                <Text style={styles.phaseLabel}>Trạng thái chuyến</Text>
                <Text style={styles.phaseValue}>{phases[phaseIndex]}</Text>
              </View>
            )}

            <View style={styles.actions}>
              {status === 'pending' && (
                <TouchableOpacity style={styles.secondary} onPress={handleDecline}>
                  <Text style={styles.secondaryText}>Từ chối</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.primary} onPress={handleAdvance}>
                <Text style={styles.primaryText}>{ctaLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyText: {
    color: palette.muted,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: palette.muted,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginTop: 4,
  },
  pricePill: {
    backgroundColor: palette.redSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  priceText: {
    color: palette.redDark,
    fontWeight: '700',
  },
  requestRow: {
    marginTop: 10,
  },
  label: {
    color: palette.muted,
    fontSize: 12,
  },
  value: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  noteBox: {
    marginTop: 12,
    backgroundColor: palette.redSoft,
    borderRadius: 12,
    padding: 12,
  },
  noteLabel: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  noteText: {
    color: palette.text,
  },
  phaseBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  phaseLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  phaseValue: {
    color: palette.text,
    fontWeight: '600',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primary: {
    flex: 1,
    backgroundColor: palette.red,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondary: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryText: {
    color: palette.redDark,
    fontWeight: '600',
  },
});
