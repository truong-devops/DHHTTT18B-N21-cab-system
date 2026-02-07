const now = Date.now();

const minutesAgo = (value) =>
  new Date(now - value * 60000).toISOString();

module.exports = [
  {
    bookingId: "bk_seed_001",
    rideId: "ride_seed_001",
    pickup: { lat: 10.776, lng: 106.701 },
    dropoff: { lat: 10.783, lng: 106.694 },
    vehicleType: "CAR",
    priceSnapshot: {
      quoteId: "quote_seed_001",
      estimatedFare: 85000,
      currency: "VND",
      distanceKm: 6.2,
      durationMin: 18,
      breakdown: {
        base: 12000,
        perKm: 31000,
        perMin: 9000,
        discount: 0,
        surge: 33000
      },
      expiresAt: minutesAgo(40)
    },
    status: "CREATED",
    createdAt: minutesAgo(45)
  },
  {
    bookingId: "bk_seed_002",
    rideId: "ride_seed_002",
    pickup: { lat: 10.771, lng: 106.703 },
    dropoff: { lat: 10.764, lng: 106.697 },
    vehicleType: "BIKE",
    priceSnapshot: {
      quoteId: "quote_seed_002",
      estimatedFare: 42000,
      currency: "VND",
      distanceKm: 3.8,
      durationMin: 12,
      breakdown: {
        base: 12000,
        perKm: 19000,
        perMin: 6000,
        discount: 0,
        surge: 5000
      },
      expiresAt: minutesAgo(30)
    },
    status: "CANCELED",
    createdAt: minutesAgo(32),
    canceledAt: minutesAgo(28)
  },
  {
    bookingId: "bk_seed_003",
    rideId: "ride_seed_003",
    pickup: { lat: 10.768, lng: 106.692 },
    dropoff: { lat: 10.773, lng: 106.688 },
    vehicleType: "SUV",
    priceSnapshot: {
      quoteId: "quote_seed_003",
      estimatedFare: 120000,
      currency: "VND",
      distanceKm: 7.1,
      durationMin: 20,
      breakdown: {
        base: 20000,
        perKm: 56800,
        perMin: 16000,
        discount: 0,
        surge: 27200
      },
      expiresAt: minutesAgo(18)
    },
    status: "CREATED",
    createdAt: minutesAgo(20)
  }
];
