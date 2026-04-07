export function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('vi-VN').format(value);
}
