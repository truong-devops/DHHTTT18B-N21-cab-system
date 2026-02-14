export const roleLabels = {
  admin: 'Quản trị',
  ops: 'Vận hành',
  customer: 'Khách hàng',
  driver: 'Tài xế',
}

export const userStatusLabels = {
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Tạm khóa',
}

export const driverStatusLabels = {
  APPROVED: 'Đã duyệt',
  PENDING: 'Chờ duyệt',
  SUSPENDED: 'Tạm khóa',
}

export const onlineStatusLabels = {
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Ngoại tuyến',
  BUSY: 'Đang bận',
}

export const rideStatusLabels = {
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  requested: 'Đã yêu cầu',
}

export const surgeStatusLabels = {
  ACTIVE: 'Đang áp dụng',
  INACTIVE: 'Ngừng áp dụng',
}

export const vehicleTypeLabels = {
  CAR: 'Ô tô',
  BIKE: 'Xe máy',
}

export const logLevelLabels = {
  INFO: 'Thông tin',
  WARN: 'Cảnh báo',
  ERROR: 'Lỗi',
}

export const markerTypeLabels = {
  driver: 'Tài xế',
  ride: 'Chuyến đi',
}

export const paymentStatusLabels = {
  INITIATED: 'Khởi tạo',
  PROCESSING: 'Đang xử lý',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Hoàn tiền',
}

export function labelFrom(map, value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return map[value] || value
}
