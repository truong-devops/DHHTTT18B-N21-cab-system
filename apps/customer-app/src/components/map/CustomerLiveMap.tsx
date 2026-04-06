import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Coordinate = {
  latitude: number
  longitude: number
  label?: string
}

type Props = {
  label?: string
  destination?: Coordinate | null
  showRoute?: boolean
  onLocationChange?: (coords: Coordinate) => void
}

export const CustomerLiveMap: React.FC<Props> = ({ label, destination, onLocationChange }) => {
  const [current, setCurrent] = useState<Coordinate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Trinh duyet khong ho tro geolocation')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
        setCurrent(next)
        setError(null)
        onLocationChange?.(next)
      },
      (geoError) => {
        setError(geoError.message || 'Khong lay duoc vi tri hien tai')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 10000
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [onLocationChange])

  const currentLabel = useMemo(() => {
    if (!current) return 'Dang cho vi tri GPS...'
    return `${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`
  }, [current])

  const destinationLabel = useMemo(() => {
    if (!destination) return 'Chua chon diem den'
    return destination.label || `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`
  }, [destination])

  return (
    <View style={styles.map}>
      <Text style={styles.title}>{label || 'Ban do vi tri thuc te'}</Text>
      <View style={styles.block}>
        <Text style={styles.kv}>Diem don: Vi tri hien tai</Text>
        <Text style={styles.value}>Toa do: {currentLabel}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.kv}>Diem den:</Text>
        <Text style={styles.value}>{destinationLabel}</Text>
        {destination ? (
          <Text style={styles.kv}>Toa do: {destination.latitude.toFixed(6)}, {destination.longitude.toFixed(6)}</Text>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#EEF1F4',
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm
  },
  title: {
    ...typography.body,
    color: colors.text
  },
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  kv: {
    ...typography.caption,
    color: colors.muted
  },
  value: {
    ...typography.body,
    color: colors.text
  },
  error: {
    ...typography.caption,
    color: '#C53030'
  }
})
