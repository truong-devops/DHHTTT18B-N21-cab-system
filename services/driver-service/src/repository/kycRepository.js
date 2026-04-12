const pool = require('../db/pool');

function isUuidLike(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function createSubmission({
  driverId,
  fullName = null,
  phone = null,
  idNumber = null,
  licenseNumber = null,
  vehicleRegistrationNumber = null,
  idFrontUrl = null,
  idBackUrl = null,
  licenseFrontUrl = null,
  selfieUrl = null
}) {
  const result = await pool.query(
    `
      INSERT INTO driver_kyc_submissions (
        driver_id,
        status,
        full_name,
        phone,
        id_number,
        license_number,
        vehicle_registration_number,
        id_front_url,
        id_back_url,
        license_front_url,
        selfie_url,
        submitted_at
      )
      VALUES ($1, 'PENDING', $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING *
    `,
    [driverId, fullName, phone, idNumber, licenseNumber, vehicleRegistrationNumber, idFrontUrl, idBackUrl, licenseFrontUrl, selfieUrl]
  );
  return result.rows[0] || null;
}

async function getLatestByDriverId(driverId) {
  const result = await pool.query(
    `
      SELECT *
      FROM driver_kyc_submissions
      WHERE driver_id = $1
      ORDER BY submitted_at DESC, created_at DESC
      LIMIT 1
    `,
    [driverId]
  );
  return result.rows[0] || null;
}

async function getById(id) {
  if (!isUuidLike(id)) return null;
  const result = await pool.query('SELECT * FROM driver_kyc_submissions WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function listSubmissions({ status, page = 1, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const values = [];
  const filters = [];

  if (status) {
    values.push(status);
    filters.push(`k.status = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(safeLimit, offset);

  const result = await pool.query(
    `
      SELECT
        k.*,
        d.user_id,
        d.full_name AS driver_full_name,
        d.phone AS driver_phone,
        d.status AS driver_status,
        d.online_status AS driver_online_status
      FROM driver_kyc_submissions k
      JOIN drivers d ON d.id = k.driver_id
      ${whereClause}
      ORDER BY k.submitted_at DESC, k.created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    items: result.rows,
    page: safePage,
    limit: safeLimit
  };
}

async function updateReview({
  id,
  status,
  rejectionReason = null,
  reviewedBy = null
}) {
  const result = await pool.query(
    `
      UPDATE driver_kyc_submissions
      SET
        status = $2,
        rejection_reason = $3,
        reviewed_by = $4,
        reviewed_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, rejectionReason, reviewedBy]
  );
  return result.rows[0] || null;
}

module.exports = {
  createSubmission,
  getLatestByDriverId,
  getById,
  listSubmissions,
  updateReview
};
