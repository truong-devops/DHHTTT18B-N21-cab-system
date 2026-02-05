import { useEffect, useState } from 'react'
import { driverApi } from '../services/driverApi'
import { useGeoLocation } from './useGeoLocation'

export const useDriverOnline = () => {
  const [online, setOnline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { location } = useGeoLocation(online)

  const syncStatus = async () => {
    const res: any = await driverApi.me()
    const status = res?.driver?.onlineStatus || res?.data?.driver?.onlineStatus
    if (status === 'ONLINE' || status === 'BUSY') {
      setOnline(true)
      return 'ONLINE'
    }
    setOnline(false)
    return 'OFFLINE'
  }

  useEffect(() => {
    if (!online || !location) return
    driverApi.updateLocation({ lat: location.latitude, lng: location.longitude }).catch(() => {
      // lỗi thật sẽ hiển thị ở nơi gọi nếu cần
    })
  }, [online, location])

  const toggleOnline = async () => {
    setError(null)
    if (online) {
      await driverApi.setOffline()
      setOnline(false)
      return
    }
    await driverApi.setOnline(location ? { lat: location.latitude, lng: location.longitude } : undefined)
    setOnline(true)
  }

  return { online, error, setError, toggleOnline, syncStatus, location }
}
