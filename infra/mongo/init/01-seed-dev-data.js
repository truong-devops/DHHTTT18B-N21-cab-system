const now = new Date();
const minutesAgo = (value) => new Date(now.getTime() - value * 60000);
const minutesFromNow = (value) => new Date(now.getTime() + value * 60000);

const rideDb = db.getSiblingDB('ride_service');

const rides = [
  {
    _id: '77777777-7777-7777-7777-777777777777',
    external_ride_id: 'ext-7777',
    booking_id: 'booking-101',
    rider_id: '10000003',
    driver_id: '99999999-9999-9999-9999-999999999999',
    pickup_lat: 10.776,
    pickup_lng: 106.701,
    dropoff_lat: 10.783,
    dropoff_lng: 106.694,
    status: 'completed',
    status_updated_at: minutesAgo(25),
    created_at: minutesAgo(45),
    updated_at: minutesAgo(20)
  },
  {
    _id: '88888888-8888-8888-8888-888888888888',
    external_ride_id: 'ext-8888',
    booking_id: 'booking-102',
    rider_id: '10000003',
    driver_id: '99999999-9999-9999-9999-999999999999',
    pickup_lat: 10.771,
    pickup_lng: 106.703,
    dropoff_lat: 10.764,
    dropoff_lng: 106.697,
    status: 'cancelled',
    status_updated_at: minutesAgo(30),
    created_at: minutesAgo(50),
    updated_at: minutesAgo(30)
  },
  {
    _id: '99999999-9999-9999-9999-999999999998',
    external_ride_id: 'ext-9998',
    booking_id: 'booking-103',
    rider_id: '10000006',
    driver_id: null,
    pickup_lat: 10.775,
    pickup_lng: 106.705,
    dropoff_lat: 10.782,
    dropoff_lng: 106.699,
    status: 'requested',
    status_updated_at: minutesAgo(5),
    created_at: minutesAgo(6),
    updated_at: minutesAgo(5)
  },
  {
    _id: '99999999-9999-9999-9999-999999999997',
    external_ride_id: 'ext-9997',
    booking_id: 'booking-104',
    rider_id: '10000003',
    driver_id: '99999999-9999-9999-9999-999999999999',
    pickup_lat: 10.768,
    pickup_lng: 106.692,
    dropoff_lat: 10.773,
    dropoff_lng: 106.688,
    status: 'assigned',
    status_updated_at: minutesAgo(12),
    created_at: minutesAgo(18),
    updated_at: minutesAgo(12)
  },
  {
    _id: '99999999-9999-9999-9999-999999999996',
    external_ride_id: 'ext-9996',
    booking_id: 'booking-105',
    rider_id: '33333333-3333-3333-3333-333333333333',
    driver_id: '99999999-9999-9999-9999-999999999999',
    pickup_lat: 10.765,
    pickup_lng: 106.69,
    dropoff_lat: 10.759,
    dropoff_lng: 106.683,
    status: 'in_progress',
    status_updated_at: minutesAgo(3),
    created_at: minutesAgo(15),
    updated_at: minutesAgo(3)
  }
];

rides.forEach((ride) => {
  rideDb.rides.updateOne({ _id: ride._id }, { $set: ride }, { upsert: true });
});

const rideHistory = [
  {
    _id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    ride_id: '77777777-7777-7777-7777-777777777777',
    from_status: 'requested',
    to_status: 'completed',
    reason: 'Seeded completion',
    actor_id: '11111111-1111-1111-1111-111111111111',
    trace_id: 'seed-trace-1',
    occurred_at: minutesAgo(25),
    created_at: minutesAgo(25),
    updated_at: minutesAgo(25)
  },
  {
    _id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    ride_id: '88888888-8888-8888-8888-888888888888',
    from_status: 'requested',
    to_status: 'cancelled',
    reason: 'Seeded cancellation',
    actor_id: '11111111-1111-1111-1111-111111111111',
    trace_id: 'seed-trace-2',
    occurred_at: minutesAgo(30),
    created_at: minutesAgo(30),
    updated_at: minutesAgo(30)
  },
  {
    _id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ride_id: '99999999-9999-9999-9999-999999999998',
    from_status: null,
    to_status: 'requested',
    reason: 'Seeded request',
    actor_id: '66666666-6666-6666-6666-666666666666',
    trace_id: 'seed-trace-3',
    occurred_at: minutesAgo(5),
    created_at: minutesAgo(5),
    updated_at: minutesAgo(5)
  }
];

rideHistory.forEach((entry) => {
  rideDb.ride_status_history.updateOne({ _id: entry._id }, { $set: entry }, { upsert: true });
});

const notificationDb = db.getSiblingDB('notification_service');

const notifications = [
  {
    _id: ObjectId('64b64c2f1f1f1f1f1f1f1f1f'),
    userId: '11111111-1111-1111-1111-111111111111',
    channels: ['email'],
    recipient: 'admin@cab.local',
    templateKey: 'seed.welcome',
    title: 'Welcome to Cab Admin',
    body: 'Seeded notification for API testing.',
    status: 'SENT',
    perChannelStatus: {
      email: {
        status: 'SENT',
        attempts: 1,
        lastAttemptAt: minutesAgo(30)
      }
    },
    sourceService: 'seed',
    sourceAction: 'init',
    sourceRef: { type: 'seed' },
    dedupeKey: 'seed-admin-1',
    scheduledAt: null,
    requestMeta: {},
    createdBy: 'seed',
    createdAt: minutesAgo(30),
    updatedAt: minutesAgo(30)
  },
  {
    _id: ObjectId('64b64c2f1f1f1f1f1f1f1f20'),
    userId: '33333333-3333-3333-3333-333333333333',
    channels: ['sms'],
    recipient: '0900000001',
    templateKey: 'seed.ride',
    title: 'Ride assigned',
    body: 'Driver is on the way.',
    status: 'PENDING',
    perChannelStatus: {
      sms: {
        status: 'PENDING',
        attempts: 0
      }
    },
    sourceService: 'ride-service',
    sourceAction: 'ride.assigned',
    sourceRef: { rideId: '99999999-9999-9999-9999-999999999997' },
    dedupeKey: 'seed-ride-1',
    scheduledAt: null,
    requestMeta: {},
    createdBy: 'seed',
    createdAt: minutesAgo(12),
    updatedAt: minutesAgo(12)
  },
  {
    _id: ObjectId('64b64c2f1f1f1f1f1f1f1f21'),
    userId: '33333333-3333-3333-3333-333333333333',
    channels: ['push'],
    recipient: 'device-token-1',
    templateKey: 'seed.delay',
    title: 'Ride delayed',
    body: 'Traffic is heavy, driver arriving soon.',
    status: 'FAILED',
    perChannelStatus: {
      push: {
        status: 'FAILED',
        attempts: 2,
        lastAttemptAt: minutesAgo(8)
      }
    },
    sourceService: 'ride-service',
    sourceAction: 'ride.delayed',
    sourceRef: { rideId: '99999999-9999-9999-9999-999999999996' },
    dedupeKey: 'seed-delay-1',
    scheduledAt: null,
    requestMeta: {},
    createdBy: 'seed',
    createdAt: minutesAgo(8),
    updatedAt: minutesAgo(8)
  },
  {
    _id: ObjectId('64b64c2f1f1f1f1f1f1f1f22'),
    userId: '11111111-1111-1111-1111-111111111111',
    channels: ['email', 'push'],
    recipient: 'admin@cab.local',
    templateKey: 'seed.alert',
    title: 'System alert',
    body: 'Scheduled maintenance window.',
    status: 'SCHEDULED',
    perChannelStatus: {
      email: {
        status: 'SCHEDULED',
        attempts: 0,
        nextAttemptAt: minutesFromNow(15)
      },
      push: {
        status: 'SCHEDULED',
        attempts: 0,
        nextAttemptAt: minutesFromNow(15)
      }
    },
    sourceService: 'ops',
    sourceAction: 'maintenance',
    sourceRef: { window: '02:00-03:00' },
    dedupeKey: 'seed-alert-1',
    scheduledAt: minutesFromNow(15),
    requestMeta: {},
    createdBy: 'seed',
    createdAt: minutesAgo(2),
    updatedAt: minutesAgo(2)
  }
];

notifications.forEach((notification) => {
  notificationDb.notifications.updateOne({ _id: notification._id }, { $set: notification }, { upsert: true });
});

const preferences = [
  {
    userId: '11111111-1111-1111-1111-111111111111',
    channels: { email: true, sms: false, push: true },
    createdAt: minutesAgo(60),
    updatedAt: minutesAgo(5)
  },
  {
    userId: '33333333-3333-3333-3333-333333333333',
    channels: { email: true, sms: true, push: false },
    createdAt: minutesAgo(60),
    updatedAt: minutesAgo(10)
  },
  {
    userId: '66666666-6666-6666-6666-666666666666',
    channels: { email: false, sms: true, push: true },
    createdAt: minutesAgo(45),
    updatedAt: minutesAgo(20)
  }
];

preferences.forEach((pref) => {
  notificationDb.notification_preferences.updateOne({ userId: pref.userId }, { $set: pref }, { upsert: true });
});
