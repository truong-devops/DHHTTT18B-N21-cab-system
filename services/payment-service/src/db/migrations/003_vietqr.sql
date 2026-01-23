ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS vietqr_payload text,
  ADD COLUMN IF NOT EXISTS vietqr_reference text,
  ADD COLUMN IF NOT EXISTS vietqr_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS vietqr_qr_url text;

CREATE INDEX IF NOT EXISTS payments_vietqr_reference_idx ON payments (vietqr_reference);
