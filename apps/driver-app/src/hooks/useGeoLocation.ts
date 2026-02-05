import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

export type GeoPoint = {
  latitude: number
  longitude: number
  accuracy?: number | null
}

export const useGeoLocation = (enabled: boolean) => {
  const [location, setLocation] = useState<GeoPoint | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null
    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setError('Location permission denied')
          return
        }
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 1000
          },
          (loc) => {
            setLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy
            })
          }
        )
      } catch (err) {
        setError('Unable to fetch location')
      }
    }

    if (enabled) start()
    return () => {
      if (subscription) subscription.remove()
    }
  }, [enabled])

  return { location, error }
}
