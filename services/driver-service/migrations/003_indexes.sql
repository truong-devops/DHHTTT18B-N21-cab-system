-- ============================================
-- INDEXES FOR CROSS-CUTTING TABLES
-- ============================================

-- Index for idempotency key expiration cleanup
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- Index for unpublished outbox events (for poller)
CREATE INDEX idx_outbox_events_unpublished ON outbox_events(published, created_at) WHERE published = FALSE;

-- Index for retry logic in outbox
CREATE INDEX idx_outbox_events_retry ON outbox_events(published, retry_count, last_retry_at) 
WHERE published = FALSE AND retry_count < 5;

-- Index for unprocessed inbox events
CREATE INDEX idx_inbox_events_unprocessed ON inbox_events(processed, created_at) WHERE processed = FALSE;

-- Index for event idempotency check
CREATE UNIQUE INDEX idx_inbox_events_event_id ON inbox_events(event_id);

-- ============================================
-- INDEXES FOR DRIVERS TABLE
-- ============================================

-- Unique constraint: one user can only have one driver profile
CREATE UNIQUE INDEX idx_drivers_user_id ON drivers(user_id) WHERE user_id IS NOT NULL;

-- Primary query: find drivers by status (for matching system)
CREATE INDEX idx_drivers_status_created ON drivers(status, created_at DESC);

-- Query: find available drivers by vehicle type and status
CREATE INDEX idx_drivers_vehicle_status ON drivers(vehicle_type, status) 
WHERE status IN ('online');

-- Query: find drivers for verification
CREATE INDEX idx_drivers_verification ON drivers(is_verified, status, created_at);

-- Query: find drivers near location (simplified bounding box query)
-- Note: For production, consider PostGIS GiST index or specialized solutions
CREATE INDEX idx_drivers_location ON drivers(current_latitude, current_longitude) 
WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

-- Query: for admin dashboard - filtering by multiple criteria
CREATE INDEX idx_drivers_created ON drivers(created_at DESC);

-- ============================================
-- INDEXES FOR DRIVER_STATUS_HISTORY
-- ============================================

-- Query: get driver status history
CREATE INDEX idx_driver_status_history_driver ON driver_status_history(driver_id, created_at DESC);

-- Query: analyze status patterns over time
CREATE INDEX idx_driver_status_history_status_time ON driver_status_history(status, created_at);

-- ============================================
-- INDEXES FOR DRIVER_DOCUMENTS
-- ============================================

-- Query: get documents by driver
CREATE INDEX idx_driver_documents_driver ON driver_documents(driver_id, document_type);

-- Query: find expiring documents
CREATE INDEX idx_driver_documents_expiry ON driver_documents(expiry_date) 
WHERE expiry_date IS NOT NULL AND is_verified = TRUE;

-- Query: find pending verifications
CREATE INDEX idx_driver_documents_pending ON driver_documents(is_verified, created_at) 
WHERE is_verified = FALSE;

-- ============================================
-- INDEXES FOR DRIVER_AVAILABILITY_SLOTS
-- ============================================

-- Query: find available drivers at specific time
CREATE INDEX idx_availability_driver_active ON driver_availability_slots(driver_id, is_active, day_of_week, start_time, end_time);

-- Query: find one-time availability slots
CREATE INDEX idx_availability_specific_date ON driver_availability_slots(specific_date, is_active) 
WHERE specific_date IS NOT NULL;

-- ============================================
-- INDEXES FOR DRIVER_EARNINGS
-- ============================================

-- Query: get driver earnings summary
CREATE INDEX idx_driver_earnings_driver ON driver_earnings(driver_id, created_at DESC);

-- Query: get earnings by payout status
CREATE INDEX idx_driver_earnings_payout_status ON driver_earnings(payout_status, created_at);

-- Query: for payment processing
CREATE INDEX idx_driver_earnings_pending_payout ON driver_earnings(payout_status, payout_date) 
WHERE payout_status IN ('pending', 'processing');

-- ============================================
-- INDEXES FOR DRIVER_LOCATION_HISTORY
-- ============================================

-- Query: get driver location history
CREATE INDEX idx_driver_location_history_driver_time ON driver_location_history(driver_id, recorded_at DESC);

-- Query: for analytics - locations by time range
CREATE INDEX idx_driver_location_history_time ON driver_location_history(recorded_at);

-- ============================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- ============================================

-- Only index active drivers for common queries
CREATE INDEX idx_drivers_active_online ON drivers(id) 
WHERE status = 'online' AND is_verified = TRUE;

-- Only index recent status history (last 30 days)
CREATE INDEX idx_recent_status_history ON driver_status_history(driver_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Index for rides in progress
CREATE INDEX idx_drivers_on_trip ON drivers(id, status_updated_at) 
WHERE status = 'on_trip';