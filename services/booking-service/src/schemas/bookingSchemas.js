const { z } = require('zod');

const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional()
});

const VehicleTypeSchema = z.enum(['BIKE', 'CAR', 'SUV']);
const UserIdSchema = z.string().regex(/^\d{8}$/, 'user_id must be an 8-digit ID');

const CreateBookingSchema = z
  .object({
    pickup: LatLngSchema,
    drop: LatLngSchema.optional(),
    dropoff: LatLngSchema.optional(),
    distance_km: z.number().min(0).optional(),
    traffic_level: z.number().min(0).max(1).optional(),
    vehicleType: VehicleTypeSchema.optional(),
    vehicle_type: VehicleTypeSchema.optional(),
    payment_method: z.enum(['CASH', 'VIETQR', 'PAYOS']).optional(),
    user_id: UserIdSchema.optional()
  })
  .superRefine((data, ctx) => {
    if (data.vehicleType && data.vehicle_type && data.vehicleType !== data.vehicle_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicleType'],
        message: 'vehicleType and vehicle_type must match'
      });
    }
  })
  .transform((data) => ({
    ...data,
    vehicleType: data.vehicleType || data.vehicle_type || 'CAR'
  }));

module.exports = { CreateBookingSchema };
