export const formatCurrency = (value: number | string, currency = 'VND') => {
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return `${value}`
  return new Intl.NumberFormat('vi-VN').format(num) + ` ${currency}`
}

export const formatDuration = (seconds: number) => {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}m ${sec}s`
}

export const formatDistance = (km: number) => `${km.toFixed(1)} km`
