import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

export default function useGeoLocation() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const request = async () => {
    setLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Permission denied')
        setLoading(false)
        return
      }
      const pos = await Location.getCurrentPositionAsync({})
      setCoords(pos.coords)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    request()
  }, [])

  return { coords, error, loading, refresh: request }
}
