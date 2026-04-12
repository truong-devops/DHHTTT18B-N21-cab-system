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

function mapKycSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    driverId: row.driver_id,
    status: row.status,
    fullName: row.full_name,
    phone: row.phone,
    idNumber: row.id_number,
    licenseNumber: row.license_number,
    vehicleRegistrationNumber: row.vehicle_registration_number,
    idFrontUrl: row.id_front_url,
    idBackUrl: row.id_back_url,
    licenseFrontUrl: row.license_front_url,
    selfieUrl: row.selfie_url,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    driver:
      row.user_id || row.driver_full_name || row.driver_status
        ? {
            userId: row.user_id || null,
            fullName: row.driver_full_name || null,
            phone: row.driver_phone || null,
            status: row.driver_status || null,
            onlineStatus: row.driver_online_status || null
          }
        : null
  };
}

module.exports = { mapDriver, mapVehicle, mapLocation, mapKycSubmission };
