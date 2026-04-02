const env = typeof process !== 'undefined' ? process.env : ({} as any)

const normalizeBool = (val: string | undefined, fallback = false) => {
  if (val == null) return fallback
  return ['1', 'true', 'yes', 'on'].includes(val.toString().toLowerCase())
}

const normalizeLatency = (val: string | undefined) => {
  if (!val) return 'normal'
  if (['fast', 'normal', 'slow'].includes(val.toLowerCase())) return val.toLowerCase()
  return 'normal'
}

export const mockConfig = {
  useMockApi: normalizeBool(env.EXPO_PUBLIC_USE_MOCK_API || env.USE_MOCK_API, true),
  scenario: env.MOCK_SCENARIO || 'happy',
  latency: normalizeLatency(env.MOCK_LATENCY || 'normal')
}

export const latencyMs = () => {
  switch (mockConfig.latency) {
    case 'fast':
      return 120 + Math.random() * 120
    case 'slow':
      return 1200 + Math.random() * 800
    default:
      return 380 + Math.random() * 320
  }
}
