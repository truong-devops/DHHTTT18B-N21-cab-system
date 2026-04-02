import { latencyMs } from '../config'
import { delay } from '../utils/delay'
import { mockUsers } from '../state/db'

export async function mockLogin(identifier: string, password: string) {
  await delay(latencyMs())
  const user = mockUsers[0]
  return {
    data: user,
    tokens: {
      accessToken: `mock-at-${Date.now()}`,
      refreshToken: `mock-rt-${Date.now()}`,
      expiresIn: '3600'
    }
  }
}

export async function mockRegister(identifier: string, password: string) {
  return mockLogin(identifier, password)
}

export async function mockVerify() {
  await delay(50)
  return { data: { userId: mockUsers[0].id, role: 'user' } }
}

export async function mockLogout() {
  await delay(50)
  return { ok: true }
}

export async function mockHealth() {
  return { ok: true }
}
