import type { DriverInfo, RideHistoryItem, RideOption } from '../mock/data'
import { mockDriver, rideOptions } from '../mock/data'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const customerMockApi = {
  async requestOtp(identifier: string) {
    await sleep(500)
    // TODO: Replace with Auth Service endpoint: POST /v1/auth/request-otp
    return { ok: Boolean(identifier.trim()) }
  },

  async verifyOtp() {
    await sleep(600)
    // TODO: Replace with Auth Service endpoint: POST /v1/auth/verify-otp
    return {
      accessToken: 'mock-access-token',
      user: { id: 'cust-01', name: 'Le Anh', phone: '0900000000' }
    }
  },

  async getRideOptions(_pickup: string, _destination: string): Promise<RideOption[]> {
    await sleep(500)
    // TODO: Replace with Pricing + ETA services: GET /quote + GET /eta
    return rideOptions
  },

  async findDriver(_rideOptionId: string): Promise<DriverInfo> {
    await sleep(1400)
    // TODO: Replace with Booking/Matching service + realtime subscription
    return mockDriver
  },

  async createPayment(_rideId: string, _method: string) {
    await sleep(700)
    // TODO: Replace with Payment Service: POST /v1/payments
    return { success: true, transactionId: `txn-${Date.now()}` }
  },

  async submitRating(_rideId: string, _stars: number, _comment: string) {
    await sleep(450)
    // TODO: Replace with Review Service: POST /v1/reviews
    return { success: true }
  },

  async getHistory(): Promise<RideHistoryItem[]> {
    await sleep(300)
    // TODO: Replace with Ride Service: GET /v1/rides/history
    return [
      {
        id: 'r1001',
        date: '2026-02-12 18:45',
        pickup: 'IUH Campus',
        destination: 'Ben Thanh Market',
        amount: 74000,
        status: 'completed'
      },
      {
        id: 'r1000',
        date: '2026-02-11 08:30',
        pickup: 'Go Vap',
        destination: 'Tan Son Nhat Airport',
        amount: 82000,
        status: 'completed'
      }
    ]
  }
}
