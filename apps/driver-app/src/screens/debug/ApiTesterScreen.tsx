import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { colors, spacing, typography } from '../../theme/tokens'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { OutlineButton } from '../../components/common/OutlineButton'
import { Banner } from '../../components/common/Banner'
import { api } from '../../services/api'
import { useLogs } from '../../store/logStore'

const ApiTesterScreen = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || ''
  const { logs, clear } = useLogs()
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const setOutput = (data: any) => {
    setResult(data)
    setError(null)
  }

  const setErr = (err: any) => {
    setError(err?.message || 'Request failed')
    setResult(err?.raw || err)
  }

  const copyResult = async () => {
    if (!result) return
    await Clipboard.setStringAsync(JSON.stringify(result, null, 2))
  }

  const logPreview = useMemo(() => logs.slice(0, 10), [logs])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Debug</Text>
      <Card style={styles.card}>
        <Text style={styles.label}>Base URL</Text>
        <Text style={styles.value}>{baseUrl}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Ping</Text>
        <PrimaryButton
          title="GET /health"
          onPress={async () => {
            try {
              const res = await api.get('/health')
              setOutput(res)
            } catch (err) {
              setErr(err)
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Output</Text>
        {error ? <Banner variant="danger" text={error} /> : null}
        <OutlineButton title="Copy JSON" onPress={copyResult} />
        <Text style={styles.mono}>{result ? JSON.stringify(result, null, 2) : 'No output yet'}</Text>
      </Card>

      <Card style={styles.card}>
        <View style={styles.logHeader}>
          <Text style={styles.section}>Recent Logs</Text>
          <OutlineButton title="Clear" onPress={clear} />
        </View>
        {logPreview.map((log) => (
          <View key={log.id} style={styles.logItem}>
            <Text style={styles.logLine}>
              {log.method} {log.status || '-'} {log.url}
            </Text>
            <Text style={styles.logMeta}>
              {log.durationMs ? `${log.durationMs}ms` : '--'} {log.requestId ? ` • ${log.requestId}` : ''}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title },
  card: { gap: spacing.md },
  section: { ...typography.h2 },
  label: { ...typography.caption, color: colors.muted },
  value: { ...typography.body },
  mono: { ...typography.caption, color: colors.text, fontFamily: 'Courier' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  logLine: { ...typography.body },
  logMeta: { ...typography.caption, color: colors.muted }
})

export default ApiTesterScreen
