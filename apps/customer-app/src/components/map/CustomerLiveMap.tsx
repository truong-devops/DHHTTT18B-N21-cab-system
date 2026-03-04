import React from 'react'
import { MapPlaceholder } from './MapPlaceholder'

type Coordinate = {
  latitude: number
  longitude: number
}

type Props = {
  label?: string
  destination?: Coordinate | null
  showRoute?: boolean
  onLocationChange?: (coords: Coordinate) => void
}

export const CustomerLiveMap: React.FC<Props> = ({ label }) => {
  return <MapPlaceholder label={label || 'Bản đồ trực tiếp chỉ hỗ trợ trên iOS/Android'} />
}
