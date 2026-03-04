export function createIdempotencyKey(prefix: string) {
  const random = Math.random().toString(16).slice(2)
  return `${prefix}-${Date.now()}-${random}`
}
