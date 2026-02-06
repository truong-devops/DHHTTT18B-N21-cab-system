import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type Request = Awaited<ReturnType<typeof mockApi.getRideRequests>>[number];

const phases = ['Đang đến điểm đón', 'Đang đón khách', 'Đang di chuyển'];
const paymentTags = ['Tiền mặt', 'Ví Be', 'Thẻ'];

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
        <View style={styles.header}>
          <Text style={styles.title}>Chuyến nhận</Text>
          <View style={styles.timerPill}>
            <Text style={styles.timerText}>03:24</Text>
          </View>
        </View>

        <View style={styles.mapPreview}>
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>Bản đồ giả lập</Text>
          </View>
          <View style={styles.mapPin} />
          <Text style={styles.mapText}>Khu vực trung tâm, Q1</Text>
        </View>

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
                <Text style={styles.priceText}>{activeRequest.price.toLocaleString('vi-VN')} đ</Text>
                <Text style={styles.priceSub}>ước tính</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{activeRequest.category}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {activeRequest.distanceKm} km • {activeRequest.durationMin} phút
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{paymentTags[activeIndex % paymentTags.length]}</Text>
              </View>
            </View>

            <View style={styles.timeline}>
              <View style={styles.timelineLine}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineBar} />
                <View style={styles.timelineDotOutline} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.label}>Điểm đón</Text>
                <Text style={styles.value}>{activeRequest.pickup}</Text>
                <Text style={styles.label}>Điểm đến</Text>
                <Text style={styles.value}>{activeRequest.dropoff}</Text>
              </View>
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

            {status === 'accepted' && (
              <TouchableOpacity style={styles.navLink} onPress={() => router.push('/ride/navigation')}>
                <Text style={styles.navLinkText}>Mở điều hướng</Text>
              </TouchableOpacity>
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
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  timerPill: {
    backgroundColor: palette.redSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  timerText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 12,
  },
  mapPreview: {
    backgroundColor: palette.redSoft,
    borderRadius: 20,
    padding: 16,
    minHeight: 140,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mapBadgeText: {
    fontSize: 11,
    color: palette.redDark,
    fontWeight: '600',
  },
  mapPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.red,
    alignSelf: 'center',
    marginBottom: 10,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  mapText: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: 12,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
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
    gap: 12,
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
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  priceText: {
    color: palette.redDark,
    fontWeight: '700',
  },
  priceSub: {
    color: palette.muted,
    fontSize: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    color: palette.redDark,
    fontSize: 11,
    fontWeight: '600',
  },
  timeline: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLine: {
    alignItems: 'center',
    marginTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.red,
  },
  timelineBar: {
    width: 2,
    height: 28,
    backgroundColor: palette.border,
    marginVertical: 4,
  },
  timelineDotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: palette.red,
    backgroundColor: '#fff',
  },
  timelineContent: {
    flex: 1,
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
    marginBottom: 10,
  },
  noteBox: {
    marginTop: 8,
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
  navLink: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  navLinkText: {
    color: palette.redDark,
    fontWeight: '600',
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
