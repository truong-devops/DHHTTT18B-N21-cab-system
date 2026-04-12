import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useRideTracking } from '@/hooks/use-ride-tracking';
import { useRide } from '@/lib/contexts/ride';
import * as rideApi from '@/lib/services/ride';
import { palette } from '@/lib/theme';

function toCurrencyLabel(amount: number | null | undefined, currency = 'VND') {
  if (!Number.isFinite(amount as number)) return '--';
  const safeAmount = Math.round(Number(amount));
  const safeCurrency = String(currency || 'VND').toUpperCase();
  if (safeCurrency === 'VND') {
    return `${safeAmount.toLocaleString('vi-VN')} đ`;
  }
  return `${safeAmount.toLocaleString('vi-VN')} ${safeCurrency}`;
}

function toDistanceLabel(distanceMeters: number | null | undefined) {
  if (!Number.isFinite(distanceMeters as number)) return '--';
  const safeDistance = Number(distanceMeters);
  if (safeDistance < 1000) {
    return `${Math.round(safeDistance)} m`;
  }
  return `${(safeDistance / 1000).toFixed(1)} km`;
}

function toDurationLabel(durationSeconds: number | null | undefined) {
  if (!Number.isFinite(durationSeconds as number)) return '--';
  const totalSeconds = Math.max(0, Math.round(Number(durationSeconds)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  return `${minutes} phút`;
}

export default function RideCompleteScreen() {
  const { activeRide, setActiveRide } = useRide();
  const rideId = activeRide?.id ?? null;
  const { ride: trackedRide } = useRideTracking({ rideId, enabled: Boolean(rideId), intervalMs: 4000 });
  const ride = trackedRide ?? activeRide;
  const [summary, setSummary] = useState<rideApi.RideSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (trackedRide) {
      setActiveRide(trackedRide);
    }
  }, [trackedRide, setActiveRide]);

  useEffect(() => {
    if (!rideId) {
      setSummary(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 6;
    const retryDelayMs = 1200;

    const fetchSummary = async () => {
      if (cancelled) return;
      setSummaryLoading(true);
      try {
        const response = await rideApi.getRideSummary(rideId);
        if (cancelled) return;
        setSummary(response.data);
        setSummaryError(null);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.status === 409 && retryCount < maxRetries) {
          retryCount += 1;
          setSummaryError('Đang cập nhật tổng kết chuyến...');
          retryTimer = setTimeout(() => {
            void fetchSummary();
          }, retryDelayMs);
          return;
        }
        setSummaryError(err?.message ?? 'Không thể tải tổng kết chuyến.');
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    setSummary(null);
    setSummaryError(null);
    void fetchSummary();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [rideId]);

  const fareAmount = useMemo(() => {
    if (!summary) return null;
    if (Number.isFinite(summary.fare?.amount)) return Number(summary.fare.amount);
    if (Number.isFinite(summary.breakdown?.total)) return Number(summary.breakdown.total);
    return null;
  }, [summary]);

  const breakdownRows = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Cước mở cửa', value: summary.breakdown.base },
      { label: 'Quãng đường', value: summary.breakdown.distance },
      { label: 'Thời gian', value: summary.breakdown.time },
      { label: 'Phụ phí', value: summary.breakdown.surge },
      { label: 'Giảm giá', value: -Math.abs(summary.breakdown.discount || 0) }
    ];
  }, [summary]);

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ScreenHeader title="Hoàn thành cuốc xe" subtitle="Không tìm thấy chuyến" variant="light" />
          <View style={styles.content}>
            <Card style={styles.summaryCard}>
              <Text style={styles.totalLabel}>Chuyến đã kết thúc</Text>
              <Text style={styles.totalValue}>--</Text>
              <Text style={styles.metricLabel}>Không có dữ liệu chuyến.</Text>
            </Card>
            <PrimaryButton
              title="Về màn hình chính"
              onPress={() => {
                setActiveRide(null);
                router.replace('/');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader title="Hoàn thành cuốc xe" subtitle="Tổng kết chuyến đi" variant="light" />

        <View style={styles.content}>
          <Card style={styles.summaryCard}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalValue}>{toCurrencyLabel(fareAmount, summary?.fare?.currency || 'VND')}</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Quãng đường</Text>
                <Text style={styles.metricValue}>{toDistanceLabel(summary?.distanceMeters)}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Thời gian</Text>
                <Text style={styles.metricValue}>{toDurationLabel(summary?.durationSeconds)}</Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>Mã chuyến: {ride.externalRideId ?? ride.id}</Text>
            {summary?.fare?.paymentStatus ? <Text style={styles.metricLabel}>Thanh toán: {summary.fare.paymentStatus}</Text> : null}
            {summaryLoading && !summary ? <Text style={styles.metricLabel}>Đang tải tổng kết...</Text> : null}
            {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
          </Card>

          <Card style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Chi tiết cước</Text>
            {breakdownRows.length === 0 ? (
              <Text style={styles.metricLabel}>--</Text>
            ) : (
              breakdownRows.map((item) => (
                <View key={item.label} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                  <Text style={styles.breakdownValue}>{toCurrencyLabel(item.value, summary?.fare?.currency || 'VND')}</Text>
                </View>
              ))
            )}
          </Card>

          <PrimaryButton
            title="HOÀN THÀNH"
            onPress={() => {
              setActiveRide(null);
              router.replace('/');
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16
  },
  summaryCard: {
    alignItems: 'center',
    gap: 12
  },
  totalLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  totalValue: {
    color: palette.red,
    fontSize: 32,
    fontWeight: '800'
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10
  },
  metricItem: {
    alignItems: 'center'
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12
  },
  metricValue: {
    color: palette.text,
    fontWeight: '700',
    marginTop: 4
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12
  },
  breakdownCard: {
    gap: 10
  },
  breakdownTitle: {
    color: palette.text,
    fontWeight: '700',
    marginBottom: 2
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  breakdownLabel: {
    color: palette.muted
  },
  breakdownValue: {
    color: palette.text,
    fontWeight: '600'
  }
});
