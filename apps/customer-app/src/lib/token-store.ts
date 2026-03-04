import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCESS_KEY = 'customerApp.accessToken'
const REFRESH_KEY = 'customerApp.refreshToken'

let accessToken: string | null = null
let refreshToken: string | null = null

export async function hydrateTokens() {
  const [storedAccess, storedRefresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY)
  ])

  accessToken = storedAccess || null
  refreshToken = storedRefresh || null
  return { accessToken, refreshToken }
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return refreshToken
}

export async function setTokens(nextAccess: string, nextRefresh: string) {
  accessToken = nextAccess
  refreshToken = nextRefresh
  await Promise.all([
    AsyncStorage.setItem(ACCESS_KEY, nextAccess),
    AsyncStorage.setItem(REFRESH_KEY, nextRefresh)
  ])
}

export async function clearTokens() {
  accessToken = null
  refreshToken = null
  await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(REFRESH_KEY)])
}
