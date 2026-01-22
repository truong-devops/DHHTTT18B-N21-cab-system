-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location-based queries (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS "postgis";