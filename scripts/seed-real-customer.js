#!/usr/bin/env node
/**
 * Seed a real customer account with ride history into the running docker stack.
 * Safe to re-run; uses upserts/ON CONFLICT DO NOTHING.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const composeArgs = ['compose', '--env-file', '.env', '-f', 'infra/docker-compose.dev.yml'];

const CUSTOMER_ID = '10000006';
const CUSTOMER_EMAIL = 'real.customer@cab.local';
const CUSTOMER_USERNAME = 'realcustomer';
const CUSTOMER_PHONE = '0905123456';
const PASSWORD_HASH = '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC'; // "password"
const RIDES = [
  {
    id: 'c0ffee00-aaaa-bbbb-cccc-111122223333',
    pickup: { lat: 10.7765, lng: 106.7009 },
    dropoff: { lat: 10.7832, lng: 106.7044 },
    status: 'completed',
    minutesAgo: 40
  },
  {
    id: 'c0ffee00-aaaa-bbbb-cccc-444455556666',
    pickup: { lat: 10.7701, lng: 106.695 },
    dropoff: { lat: 10.7603, lng: 106.6892 },
    status: 'completed',
    minutesAgo: 75
  }
];

function runDocker(args, { capture = false } = {}) {
  const res = spawnSync('docker', [...composeArgs, ...args], {
    cwd: repoRoot,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8'
  });
  if (res.error) throw res.error;
  if (res.status !== 0 && !capture) {
    throw new Error(`docker ${args.join(' ')} failed with ${res.status}`);
  }
  return res;
}

function seedPostgres() {
  const sqlAuth = `
    INSERT INTO users (id, email, username, password_hash, role, status)
    VALUES ('${CUSTOMER_ID}', '${CUSTOMER_EMAIL}', '${CUSTOMER_USERNAME}', '${PASSWORD_HASH}', 'user', 'active')
    ON CONFLICT (id) DO NOTHING;
  `;

  const sqlUser = `
    INSERT INTO users (id, email, full_name, phone, role, status)
    VALUES ('${CUSTOMER_ID}', '${CUSTOMER_EMAIL}', 'Customer Real', '${CUSTOMER_PHONE}', 'customer', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
  `;

  const sqlPayment = `
    INSERT INTO payments (id, ride_id, user_id, amount, currency, method, status, status_updated_at, created_at, updated_at)
    VALUES
      ('c0ffee00-9999-aaaa-bbbb-111122223333', '${RIDES[0].id}', '${CUSTOMER_ID}', 95000, 'VND', 'CASH', 'PAID', now(), now(), now()),
      ('c0ffee00-9999-aaaa-bbbb-444455556666', '${RIDES[1].id}', '${CUSTOMER_ID}', 125000, 'VND', 'CARD', 'PAID', now(), now(), now())
    ON CONFLICT (id) DO NOTHING;
  `;

  runDocker(['exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'cab', '-d', 'auth-service_db', '-c', sqlAuth]);

  runDocker(['exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'cab', '-d', 'user-service_db', '-c', sqlUser]);

  runDocker(['exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'cab', '-d', 'payment-service_db', '-c', sqlPayment]);
}

function seedMongo() {
  const now = Date.now();
  const rideDocs = RIDES.map((ride) => {
    const ts = new Date(now - ride.minutesAgo * 60000).toISOString();
    return `
      {
        _id: "${ride.id}",
        external_ride_id: "${ride.id}",
        booking_id: "seed-booking-${ride.id.slice(0, 8)}",
        rider_id: "${CUSTOMER_ID}",
        driver_id: "99999999-9999-9999-9999-999999999999",
        pickup_lat: ${ride.pickup.lat},
        pickup_lng: ${ride.pickup.lng},
        dropoff_lat: ${ride.dropoff.lat},
        dropoff_lng: ${ride.dropoff.lng},
        status: "${ride.status}",
        status_updated_at: ISODate("${ts}"),
        created_at: ISODate("${ts}"),
        updated_at: ISODate("${ts}")
      }
    `;
  }).join(',');

  const script = `
    const rideDb = db.getSiblingDB("ride_service");
    const rides = [${rideDocs}];
    rides.forEach(r => rideDb.rides.updateOne({_id: r._id}, {$set: r}, {upsert: true}));
  `;

  runDocker(['exec', '-T', 'mongo', 'mongosh', '--quiet', '--eval', script.replace(/\s+/g, ' ')]);
}

function main() {
  console.log('[seed-real-customer] Seeding real customer + history...');
  seedPostgres();
  seedMongo();
  console.log(`[seed-real-customer] Done. Login: ${CUSTOMER_EMAIL} / password (role customer).`);
}

main();
