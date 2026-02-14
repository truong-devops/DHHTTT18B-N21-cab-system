function mapDriver(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    onlineStatus: row.online_status,
    fullName: row.full_name,
    phone: row.phone,
    vehicleType: row.vehicle_type || null,
    plateNumber: row.plate_number || null,
    location:
      row.location_lat !== null && row.location_lat !== undefined
        ? {
            lat: row.location_lat,
            lng: row.location_lng,
            recordedAt: row.location_recorded_at
          }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVehicle(row) {
  if (!row) return null;
  return {
    id: row.id,
    driverId: row.driver_id,
    vehicleType: row.vehicle_type,
    plateNumber: row.plate_number,
    brand: row.brand,
    model: row.model,
    color: row.color,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLocation(row) {
  if (!row) return null;
  return {
    driverId: row.driver_id,
    lat: row.lat,
    lng: row.lng,
    heading: row.heading,
    speed: row.speed,
    accuracyM: row.accuracy_m,
    recordedAt: row.recorded_at
  };
}

module.exports = { mapDriver, mapVehicle, mapLocation };
