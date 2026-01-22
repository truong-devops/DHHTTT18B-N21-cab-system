-- ============================================
-- CROSS-CUTTING TABLES (REQUIRED FOR ALL SERVICES)
-- ============================================

-- Idempotency keys for POST requests
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA256 of idempotency key
    request_hash VARCHAR(64) NOT NULL,     -- SHA256 of request body + path + method
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    response_headers JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations';

-- Outbox events for reliable messaging (Transactional Outbox Pattern)
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    trace_id VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    type VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    payload JSONB NOT NULL,
    topic VARCHAR(255) NOT NULL,
    partition_key VARCHAR(255),
    published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE outbox_events IS 'Transactional outbox for reliable event publishing';

-- Inbox events for idempotent message processing
CREATE TABLE inbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    trace_id VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    type VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inbox_events IS 'Inbox for idempotent event processing';

-- ============================================
-- DRIVER SERVICE CORE TABLES
-- ============================================

-- Main drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- Reference to user in auth/user service (no FK cross-service)
    
    -- License information
    license_number VARCHAR(50) NOT NULL,
    license_expiry_date DATE NOT NULL,
    
    -- Vehicle information
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'van', 'premium', 'motorcycle')),
    vehicle_brand VARCHAR(50) NOT NULL,
    vehicle_model VARCHAR(50) NOT NULL,
    vehicle_year INTEGER NOT NULL CHECK (vehicle_year >= 2000 AND vehicle_year <= EXTRACT(YEAR FROM NOW()) + 1),
    vehicle_color VARCHAR(30) NOT NULL,
    vehicle_plate VARCHAR(20) UNIQUE NOT NULL,
    
    -- Status and location
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'on_trip', 'inactive', 'suspended')),
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Current location (using separate lat/lng columns for simplicity)
    -- Alternative: Use PostGIS geometry(Point, 4326) if extension is enabled
    current_latitude DECIMAL(9,6),
    current_longitude DECIMAL(9,6),
    current_location_updated_at TIMESTAMPTZ,
    
    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID,  -- admin user_id who verified
    
    -- Performance metrics
    rating_avg DECIMAL(3,2) DEFAULT 0.0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
    total_ratings INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE drivers IS 'Stores driver information including vehicle details and current status';

-- Driver status history (RECOMMENDED)
CREATE TABLE driver_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('offline', 'online', 'on_trip', 'inactive', 'suspended')),
    reason TEXT,  -- Optional reason for status change
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_status_history IS 'Tracks historical status changes for drivers';

-- Driver documents (license, insurance, registration, etc.)
CREATE TABLE driver_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('license', 'insurance', 'registration', 'photo', 'vehicle_front', 'vehicle_back', 'vehicle_side')),
    document_url VARCHAR(500) NOT NULL,
    document_id VARCHAR(100),  -- External document ID (e.g., license number)
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,  -- admin user_id
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_documents IS 'Stores driver documents for verification';

-- Driver availability schedule
CREATE TABLE driver_availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday, NULL for specific dates
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring BOOLEAN DEFAULT TRUE,
    specific_date DATE,  -- For non-recurring slots
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure either day_of_week (recurring) or specific_date (one-time) is set
    CONSTRAINT chk_recurring_logic CHECK (
        (is_recurring = TRUE AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
        (is_recurring = FALSE AND day_of_week IS NULL AND specific_date IS NOT NULL)
    ),
    CONSTRAINT chk_valid_time CHECK (end_time > start_time)
);

COMMENT ON TABLE driver_availability_slots IS 'Stores driver availability schedule';

-- Driver earnings and payments
CREATE TABLE driver_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    ride_id UUID NOT NULL,  -- Reference to ride-service (no FK cross-service)
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    commission DECIMAL(10,2) NOT NULL CHECK (commission >= 0),
    net_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - commission) STORED,
    currency VARCHAR(3) DEFAULT 'VND',
    payout_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    payout_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payout_date DATE,
    transaction_id VARCHAR(100),  -- Payment gateway transaction ID
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_earnings IS 'Tracks driver earnings per ride';

-- Driver location history (for tracking and analytics)
CREATE TABLE driver_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    accuracy DECIMAL(6,2),  -- GPS accuracy in meters
    speed DECIMAL(6,2),     -- Speed in km/h
    heading DECIMAL(5,2),   -- Direction in degrees
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_location_history IS 'Historical GPS locations for drivers (for tracking and analytics)';

-- ============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_idempotency_keys_updated_at BEFORE UPDATE ON idempotency_keys
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbox_events_updated_at BEFORE UPDATE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_events_updated_at BEFORE UPDATE ON inbox_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_documents_updated_at BEFORE UPDATE ON driver_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_availability_slots_updated_at BEFORE UPDATE ON driver_availability_slots
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_earnings_updated_at BEFORE UPDATE ON driver_earnings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update status_updated_at on status changes
CREATE OR REPLACE FUNCTION update_driver_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_status_timestamp_trigger BEFORE UPDATE OF status ON drivers
FOR EACH ROW EXECUTE FUNCTION update_driver_status_timestamp();

CREATE OR REPLACE FUNCTION update_driver_earnings_payout_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payout_status IS DISTINCT FROM NEW.payout_status THEN
        NEW.payout_status_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_earnings_payout_status_timestamp_trigger BEFORE UPDATE OF payout_status ON driver_earnings
FOR EACH ROW EXECUTE FUNCTION update_driver_earnings_payout_status_timestamp();

-- Trigger to automatically update driver status history
CREATE OR REPLACE FUNCTION log_driver_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO driver_status_history (driver_id, status, latitude, longitude)
        VALUES (NEW.id, NEW.status, NEW.current_latitude, NEW.current_longitude);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_driver_status_trigger AFTER UPDATE OF status ON drivers
FOR EACH ROW EXECUTE FUNCTION log_driver_status_change();
