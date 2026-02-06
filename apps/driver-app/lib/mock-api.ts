type DriverProfile = {
  id: string;
  name: string;
  rating: number;
  phone: string;
  vehicle: string;
  plate: string;
  online: boolean;
};

type RideRequest = {
  id: string;
  title: string;
  passenger: string;
  category: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  pickup: string;
  dropoff: string;
  note: string;
};

type RideHistoryItem = {
  id: string;
  time: string;
  route: string;
  amount: number;
  status: 'COMPLETED' | 'CANCELLED';
};

type WalletSummary = {
  balance: number;
  pending: number;
  today: number;
  payoutDate: string;
};

type ActiveRide = {
  id: string;
  passenger: string;
  pickup: string;
  dropoff: string;
  remainingTimeMin: number;
  nextDistanceKm: number;
  totalDistanceKm: number;
  paymentMethod: string;
};

type RideSummary = {
  totalAmount: number;
  distanceKm: number;
  durationMin: number;
};

const driverProfile: DriverProfile = {
  id: 'drv-101',
  name: 'Nguyễn Hoàng',
  rating: 4.9,
  phone: '0909 123 456',
  vehicle: 'Toyota Vios 2023',
  plate: '51A-123.45',
  online: true,
};

const rideRequests: RideRequest[] = [
  {
    id: 'req-1',
    title: 'Chuyến sân bay',
    passenger: 'Kiều Trang',
    category: 'Premium',
    distanceKm: 15.2,
    durationMin: 28,
    price: 324000,
    pickup: 'Công viên Tao Đàn',
    dropoff: 'Ga Quốc Tế T2',
    note: '2 vali, cần cốp rộng',
  },
  {
    id: 'req-2',
    title: 'Đón khách văn phòng',
    passenger: 'Minh Anh',
    category: 'Tiêu chuẩn',
    distanceKm: 6.4,
    durationMin: 18,
    price: 118000,
    pickup: 'Nguyễn Huệ',
    dropoff: 'Tòa nhà Techcombank',
    note: 'Đợi 3 phút ở sảnh',
  },
  {
    id: 'req-3',
    title: 'Đưa khách bệnh viện',
    passenger: 'Võ Thanh',
    category: 'Tiêu chuẩn',
    distanceKm: 8.7,
    durationMin: 22,
    price: 142000,
    pickup: 'Lê Lợi',
    dropoff: 'Bệnh viện Đại học Y Dược',
    note: 'Có người lớn tuổi đi cùng',
  },
];

const rideHistory: RideHistoryItem[] = [
  { id: 'ride-1', time: '08:30', route: 'Bến Thành → Quận 7', amount: 95000, status: 'COMPLETED' },
  { id: 'ride-2', time: '09:10', route: 'Thảo Điền → Q1', amount: 128000, status: 'COMPLETED' },
  { id: 'ride-3', time: '10:05', route: 'Q3 → Sân bay T1', amount: 0, status: 'CANCELLED' },
  { id: 'ride-4', time: '11:20', route: 'Q10 → Q5', amount: 76000, status: 'COMPLETED' },
];

const walletSummary: WalletSummary = {
  balance: 1850000,
  pending: 320000,
  today: 684000,
  payoutDate: 'Thứ Sáu, 07/02',
};

const activeRide: ActiveRide = {
  id: 'ride-live-01',
  passenger: 'Kieu Trang',
  pickup: 'Cong vien Tao Dan',
  dropoff: 'Ga Quoc Te T2',
  remainingTimeMin: 18,
  nextDistanceKm: 2.4,
  totalDistanceKm: 15.2,
  paymentMethod: 'Tien mat',
};

const rideSummary: RideSummary = {
  totalAmount: 324000,
  distanceKm: 15.2,
  durationMin: 28,
};

const payouts = [
  { id: 'pay-1', date: '04/02', amount: 1200000, status: 'Đã chuyển' },
  { id: 'pay-2', date: '02/02', amount: 980000, status: 'Đã chuyển' },
];

function mockDelay<T>(data: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const mockApi = {
  async getDriverProfile() {
    return mockDelay(driverProfile);
  },
  async getDashboard() {
    return mockDelay({
      earningsToday: 684000,
      tripsToday: 12,
      rating: 4.9,
      onlineTime: '5h 42m',
      hotZone: 'Trung tâm Q1 +12%',
      boost: '1.6x đến 09:30',
      acceptanceRate: 92,
      cancelRate: 3,
      nextGoal: 'Thêm 4 chuyến để nhận thưởng 120k',
    });
  },
  async getRideRequests() {
    return mockDelay(rideRequests);
  },
  async getRideHistory() {
    return mockDelay(rideHistory);
  },
  async getActiveRide() {
    return mockDelay(activeRide);
  },
  async getRideSummary() {
    return mockDelay(rideSummary);
  },
  async getWalletSummary() {
    return mockDelay({ summary: walletSummary, payouts });
  },
};
