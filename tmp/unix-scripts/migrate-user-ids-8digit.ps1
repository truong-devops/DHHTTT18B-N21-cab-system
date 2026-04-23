<#
  Migrate all user IDs from UUID -> 8-digit numeric strings across dev stack.
  Assumes Docker stack (infra/docker-compose.dev.yml) is running and Postgres/Mongo containers are named "postgres" and "mongo".
  Backup before running.
  This script:
    1) Generates new 8-digit IDs in user-service_db (authoritative).
    2) Exports mapping (old_id, new_id, email).
    3) Applies mapping to auth-service_db, driver-service_db, payment-service_db, review-service_db.
    4) Updates Mongo ride_service + notification_service rider/driver/user ids.
    5) Swaps columns to drop old UUID ids.
#>

param(
  [string] $ComposeFile = "infra/docker-compose.dev.yml",
  [string] $EnvFile = ".env",
  [string] $MapFile = ".run-logs/user_id_map.csv"
)

$ErrorActionPreference = "Stop"

function Run-DockerPsql {
  param(
    [string] $Database,
    [string] $Sql
  )
  $cmd = "docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres psql -U cab -d $Database -v ON_ERROR_STOP=1 -c ""$Sql"""
  Write-Host "psql:$Database => $($Sql.Substring(0,[Math]::Min(80,$Sql.Length)))..."
  iex $cmd
}

function Run-DockerMongo {
  param([string] $Script)
  $cmd = "docker compose --env-file $EnvFile -f $ComposeFile exec -T mongo mongosh --quiet --eval ""$Script"""
  Write-Host "mongo => $($Script.Substring(0,[Math]::Min(80,$Script.Length)))..."
  iex $cmd
}

# 1) user-service_db: create new_id, sequence, fill mapping (id stays UUID until end)
Run-DockerPsql "user-service_db" @"
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user8_seq') THEN
    CREATE SEQUENCE user8_seq START 10000000;
  END IF;
END$$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS new_id CHAR(8);
UPDATE users SET new_id = LPAD(nextval('user8_seq')::text,8,'0') WHERE new_id IS NULL;
ALTER TABLE users ALTER COLUMN new_id SET NOT NULL;
-- temp map table
DROP TABLE IF EXISTS user_id_map;
CREATE TABLE user_id_map AS SELECT id AS old_id, new_id, email FROM users;
"@

# 2) Export mapping
Write-Host "Exporting mapping to $MapFile ..."
docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres psql -U cab -d user-service_db -At -F ',' -c "SELECT old_id,new_id,email FROM user_id_map" | Out-File -Encoding ascii $MapFile

# Helper to load map into target DB
function Import-Map-ToDb {
  param([string] $DbName)
  Write-Host "Importing map into $DbName ..."
  $drop = "DROP TABLE IF EXISTS user_id_map;"
  Run-DockerPsql $DbName $drop
  $create = "CREATE TABLE user_id_map(old_id uuid, new_id char(8), email text);"
  Run-DockerPsql $DbName $create
  $copyCmd = "cmd /c type $MapFile | docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres psql -U cab -d $DbName -c ""\\copy user_id_map FROM STDIN WITH (FORMAT csv)"""
  iex $copyCmd
}

# 3) auth-service_db
Import-Map-ToDb "auth-service_db"
Run-DockerPsql "auth-service_db" @"
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_id CHAR(8);
UPDATE users u SET new_id = m.new_id FROM user_id_map m WHERE u.email = m.email;
ALTER TABLE users ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS new_user_id CHAR(8);
UPDATE refresh_tokens r SET new_user_id = m.new_id FROM users u JOIN user_id_map m ON u.email = m.email WHERE r.user_id = u.id;
ALTER TABLE refresh_tokens ALTER COLUMN new_user_id SET NOT NULL;
-- swap ids
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users RENAME COLUMN id TO id_old;
ALTER TABLE users RENAME COLUMN new_id TO id;
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_idx;
ALTER TABLE refresh_tokens RENAME COLUMN user_id TO user_id_old;
ALTER TABLE refresh_tokens RENAME COLUMN new_user_id TO user_id;
-- defaults for new rows
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user8_seq') THEN
    CREATE SEQUENCE user8_seq START 20000000;
  END IF;
END$$;
ALTER TABLE users ALTER COLUMN id SET DEFAULT LPAD(nextval('user8_seq')::text,8,'0');
"@

# 4) driver-service_db
Import-Map-ToDb "driver-service_db"
Run-DockerPsql "driver-service_db" @"
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_user_id_fkey;
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_user_id_key;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS new_user_id CHAR(8);
UPDATE drivers d SET new_user_id = m.new_id FROM user_id_map m WHERE d.user_id = m.old_id;
ALTER TABLE drivers ALTER COLUMN new_user_id SET NOT NULL;
ALTER TABLE drivers RENAME COLUMN user_id TO user_id_old;
ALTER TABLE drivers RENAME COLUMN new_user_id TO user_id;
ALTER TABLE drivers ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);
ALTER TABLE drivers ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
"@

# 5) payment-service_db
Import-Map-ToDb "payment-service_db"
Run-DockerPsql "payment-service_db" @"
ALTER TABLE payments ADD COLUMN IF NOT EXISTS new_user_id CHAR(8);
UPDATE payments p SET new_user_id = m.new_id FROM user_id_map m WHERE p.user_id = m.old_id;
ALTER TABLE payments ALTER COLUMN new_user_id SET NOT NULL;
ALTER TABLE payments RENAME COLUMN user_id TO user_id_old;
ALTER TABLE payments RENAME COLUMN new_user_id TO user_id;
ALTER TABLE payments DROP COLUMN IF EXISTS user_id_old;
"@

# 6) review-service_db (rider_id, driver_id, user_id)
Import-Map-ToDb "review-service_db"
Run-DockerPsql "review-service_db" @"
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS new_rider_id CHAR(8);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS new_driver_id CHAR(8);
UPDATE reviews r SET
  new_rider_id = m1.new_id,
  new_driver_id = m2.new_id
FROM user_id_map m1, user_id_map m2
WHERE r.rider_id = m1.old_id AND r.driver_id = m2.old_id;
ALTER TABLE reviews ALTER COLUMN new_rider_id SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN new_driver_id SET NOT NULL;
ALTER TABLE reviews RENAME COLUMN rider_id TO rider_id_old;
ALTER TABLE reviews RENAME COLUMN driver_id TO driver_id_old;
ALTER TABLE reviews RENAME COLUMN new_rider_id TO rider_id;
ALTER TABLE reviews RENAME COLUMN new_driver_id TO driver_id;

ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS new_user_id CHAR(8);
UPDATE idempotency_keys ik SET new_user_id = m.new_id FROM user_id_map m WHERE ik.user_id = m.old_id;
ALTER TABLE idempotency_keys ALTER COLUMN new_user_id SET NOT NULL;
ALTER TABLE idempotency_keys RENAME COLUMN user_id TO user_id_old;
ALTER TABLE idempotency_keys RENAME COLUMN new_user_id TO user_id;

ALTER TABLE reviews DROP COLUMN IF EXISTS rider_id_old;
ALTER TABLE reviews DROP COLUMN IF EXISTS driver_id_old;
ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS user_id_old;
"@

# 7) user-service_db finalize (swap ids, drop old)
Run-DockerPsql "user-service_db" @"
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users RENAME COLUMN id TO id_old;
ALTER TABLE users RENAME COLUMN new_id TO id;
ALTER TABLE users ADD PRIMARY KEY (id);
-- optional: drop old id column
-- ALTER TABLE users DROP COLUMN id_old;
ALTER TABLE users ALTER COLUMN id SET DEFAULT LPAD(nextval('user8_seq')::text,8,'0');
"@

# 8) Mongo updates
$mapJson = Get-Content $MapFile | ForEach-Object {
  $parts = $_ -split ","
  @{ old = $parts[0]; new = $parts[1] }
} | ConvertTo-Json -Compress

Run-DockerMongo @'
var map = $mapJson;
var toMap = {};
map.forEach(function(m){ toMap[m.old] = m.new; });

db = db.getSiblingDB('ride_service');
db.rides.find().forEach(function(r){
  var updates = {};
  if (r.rider_id && toMap[r.rider_id]) updates.rider_id = toMap[r.rider_id];
  if (r.driver_id && toMap[r.driver_id]) updates.driver_id = toMap[r.driver_id];
  if (Object.keys(updates).length) db.rides.updateOne({_id: r._id}, {$set: updates});
});

db = db.getSiblingDB('notification_service');
db.notifications.find().forEach(function(n){
  if (n.userId && toMap[n.userId]) {
    db.notifications.updateOne({_id: n._id}, {$set: {userId: toMap[n.userId]}});
  }
});
'@

Write-Host "DONE. Mapping saved at $MapFile. Please restart services and run seeds if needed."
