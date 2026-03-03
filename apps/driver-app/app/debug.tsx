import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { API_BASE_URL } from '@/lib/config';
import { apiRequest } from '@/lib/api';
import { getLogs, subscribeLogs, type ApiLog } from '@/lib/log-store';
import { palette } from '@/lib/theme';

type PingState = {
  loading: boolean;
  data: string | null;
  error: string | null;
};

export default function DebugScreen() {
  const [logs, setLogs] = useState<ApiLog[]>(() => getLogs().slice(0, 10));
  const [ping, setPing] = useState<PingState>({
    loading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeLogs(() => {
      setLogs(getLogs().slice(0, 10));
    });
    return unsubscribe;
  }, []);

  const handlePing = async () => {
    setPing({ loading: true, data: null, error: null });
    try {
      const res = await apiRequest({
        method: 'GET',
        path: '/health',
        auth: false,
      });
      setPing({ loading: false, data: JSON.stringify(res, null, 2), error: null });
    } catch (err: any) {
      setPing({
        loading: false,
        data: null,
        error: err?.message ?? 'Ping thất bại',
      });
    }
  };

  const logItems = useMemo(() => logs.slice(0, 10), [logs]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Debug API" subtitle="Quan sát request/response" variant="light">
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeText}>Đóng</Text>
          </TouchableOpacity>
        </ScreenHeader>

        <Card>
          <Text style={styles.sectionTitle}>Base URL</Text>
          <Text style={styles.monoText}>{API_BASE_URL || '--'}</Text>
          <PrimaryButton
            title={ping.loading ? 'ĐANG PING...' : 'PING /health'}
            onPress={handlePing}
            disabled={ping.loading}
            style={styles.pingButton}
          />
          {ping.error ? <Text style={styles.errorText}>{ping.error}</Text> : null}
          {ping.data ? (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>{ping.data}</Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Last 10 API logs</Text>
          {logItems.length === 0 ? (
            <Text style={styles.mutedText}>Chưa có request nào.</Text>
          ) : (
            logItems.map((item) => (
              <View key={item.id} style={styles.logRow}>
                <View style={styles.logHeader}>
                  <Text style={styles.logMethod}>{item.method}</Text>
                  <Text style={styles.logStatus}>
                    {item.status ?? '--'} · {item.durationMs ?? '--'}ms
                  </Text>
                </View>
                <Text style={styles.logUrl} numberOfLines={1}>
                  {item.url}
                </Text>
                <Text style={styles.logMeta}>
                  {new Date(item.ts).toLocaleTimeString()} {item.requestId ? `· ${item.requestId}` : ''}
                </Text>
                {item.error ? <Text style={styles.errorText}>{item.error}</Text> : null}
              </View>
            ))
          )}
        </Card>
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
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#fff',
  },
  closeText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  monoText: {
    fontSize: 12,
    color: palette.text,
  },
  pingButton: {
    marginTop: 12,
  },
  responseBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#F9FAFB',
  },
  responseText: {
    fontSize: 11,
    color: palette.text,
  },
  logRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10,
    marginTop: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logMethod: {
    fontWeight: '700',
    color: palette.text,
    fontSize: 12,
  },
  logStatus: {
    fontSize: 11,
    color: palette.muted,
  },
  logUrl: {
    fontSize: 11,
    color: palette.text,
    marginTop: 4,
  },
  logMeta: {
    fontSize: 10,
    color: palette.muted,
    marginTop: 4,
  },
  mutedText: {
    fontSize: 12,
    color: palette.muted,
  },
  errorText: {
    marginTop: 8,
    color: palette.redDark,
    fontSize: 12,
  },
});
