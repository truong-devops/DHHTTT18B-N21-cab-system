import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCESS_KEY = 'driver_access_token'
const REFRESH_KEY = 'driver_refresh_token'

type TokenCache = {
  accessToken: string | null
  refreshToken: string | null
  hydrated: boolean
}

const cache: TokenCache = {
  accessToken: null,
  refreshToken: null,
  hydrated: false
}

const safeGet = async (key: string) => {
  try {
    const value = await SecureStore.getItemAsync(key)
    if (value) return value
  } catch {}
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = async (key: string, value: string | null) => {
  if (value == null) return
  try {
    await SecureStore.setItemAsync(key, value)
    return
  } catch {}
  try {
    await AsyncStorage.setItem(key, value)
  } catch {}
}

const safeRemove = async (key: string) => {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {}
  try {
    await AsyncStorage.removeItem(key)
  } catch {}
}

export const hydrateTokens = async () => {
  if (cache.hydrated) return cache
  const [accessToken, refreshToken] = await Promise.all([safeGet(ACCESS_KEY), safeGet(REFRESH_KEY)])
  cache.accessToken = accessToken
  cache.refreshToken = refreshToken
  cache.hydrated = true
  return cache
}

export const setTokens = async (accessToken: string | null, refreshToken: string | null) => {
  cache.accessToken = accessToken
  cache.refreshToken = refreshToken
  cache.hydrated = true
  if (accessToken) await safeSet(ACCESS_KEY, accessToken)
  if (refreshToken) await safeSet(REFRESH_KEY, refreshToken)
}

export const clearTokens = async () => {
  cache.accessToken = null
  cache.refreshToken = null
  cache.hydrated = true
  await Promise.all([safeRemove(ACCESS_KEY), safeRemove(REFRESH_KEY)])
}

export const getAccessTokenSync = () => cache.accessToken
export const getRefreshTokenSync = () => cache.refreshToken
