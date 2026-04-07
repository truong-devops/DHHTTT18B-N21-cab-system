const { z } = require('zod');

const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional()
});

const CreateBookingSchema = z.object({
  pickup: LatLngSchema,
  drop: LatLngSchema.optional(),
  dropoff: LatLngSchema.optional(),
  distance_km: z.number().min(0).optional(),
  traffic_level: z.number().min(0).max(1).optional(),
  vehicleType: z.enum(['BIKE', 'CAR', 'SUV']).default('CAR'),
  payment_method: z.enum(['CASH', 'VIETQR', 'PAYOS']).optional(),
  user_id: z.string().optional()
});

module.exports = { CreateBookingSchema };
