export const formatMoney = (value, currency = 'VND') => {
  const num = Number(value || 0)
  return new Intl.NumberFormat('vi-VN').format(num) + ' ' + currency
}

export const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
