const { z } = require("zod");

const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional()
});

const CreateBookingSchema = z.object({
  pickup: LatLngSchema,
  dropoff: LatLngSchema,
  vehicleType: z.enum(["BIKE", "CAR", "SUV"]).default("CAR"),
});

module.exports = { CreateBookingSchema };
