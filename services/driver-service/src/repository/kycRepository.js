const pool = require('../db/pool');

let kycTableAvailableCache = null;

function isMissingKycTableError(error) {
  return error?.code === '42P01';
}

async function isKycTableAvailable() {
  if (kycTableAvailableCache !== null) {
    return kycTableAvailableCache;
  }
  try {
    const result = await pool.query("SELECT to_regclass('public.driver_kyc_submissions') AS table_name");
    const available = Boolean(result.rows?.[0]?.table_name);
    kycTableAvailableCache = available;
    return available;
  } catch (_error) {
    // If metadata probe fails, do not block requests; fallback to runtime query handling.
    return true;
  }
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
  try {
    const result = await pool.query('SELECT * FROM driver_kyc_submissions WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    if (error?.code === '22P02') {
      return null;
    }
    throw error;
  }
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

async function getSubmissionStats() {
  const available = await isKycTableAvailable();
  if (!available) {
    return {
      totalSubmissions: 0,
      pendingSubmissions: 0,
      approvedSubmissions: 0,
      rejectedSubmissions: 0,
      available: false
    };
  }

  let result;
  try {
    result = await pool.query(
      `
        SELECT
          count(*)::int AS total_submissions,
          count(*) FILTER (WHERE status = 'PENDING')::int AS pending_submissions,
          count(*) FILTER (WHERE status = 'APPROVED')::int AS approved_submissions,
          count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_submissions
        FROM driver_kyc_submissions
      `
    );
  } catch (error) {
    if (isMissingKycTableError(error)) {
      kycTableAvailableCache = false;
      return {
        totalSubmissions: 0,
        pendingSubmissions: 0,
        approvedSubmissions: 0,
        rejectedSubmissions: 0,
        available: false
      };
    }
    throw error;
  }

  const row = result.rows[0] || {};
  return {
    totalSubmissions: Number(row.total_submissions || 0),
    pendingSubmissions: Number(row.pending_submissions || 0),
    approvedSubmissions: Number(row.approved_submissions || 0),
    rejectedSubmissions: Number(row.rejected_submissions || 0),
    available: true
  };
}

module.exports = {
  createSubmission,
  getLatestByDriverId,
  getById,
  listSubmissions,
  updateReview,
  getSubmissionStats
};
