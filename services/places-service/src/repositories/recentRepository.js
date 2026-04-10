const { normalizeText, toFiniteNumber } = require('../utils/normalize');

function normalizeSavedPlace(input) {
  const label = String(input?.label || '').trim();
  const address = String(input?.address || '').trim();
  const normalizedLabel = normalizeText(label);
  const lat = toFiniteNumber(input?.lat);
  const lng = toFiniteNumber(input?.lng);
  const placeId = String(input?.id || normalizedLabel || `place-${Date.now()}`).trim();

  return {
    id: placeId,
    label,
    address: address || label,
    normalizedLabel,
    lat,
    lng
  };
}

function createRecentRepository({ pool, maxRecentPerUser }) {
  async function listByUser(userId, limit) {
    const result = await pool.query(
      `
        SELECT place_id, label, address, lat, lng
        FROM places_recent_destinations
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    );

    return result.rows.map((row) => ({
      id: row.place_id,
      label: row.label,
      address: row.address || row.label,
      lat: toFiniteNumber(row.lat),
      lng: toFiniteNumber(row.lng)
    }));
  }

  async function upsertByUser(userId, place) {
    const normalized = normalizeSavedPlace(place);
    await pool.query(
      `
        INSERT INTO places_recent_destinations (user_id, normalized_label, place_id, label, address, lat, lng)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, normalized_label)
        DO UPDATE SET
          place_id = EXCLUDED.place_id,
          label = EXCLUDED.label,
          address = EXCLUDED.address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          created_at = NOW()
      `,
      [userId, normalized.normalizedLabel, normalized.id, normalized.label, normalized.address, normalized.lat, normalized.lng]
    );

    await pool.query(
      `
        DELETE FROM places_recent_destinations
        WHERE user_id = $1
          AND id NOT IN (
            SELECT id
            FROM places_recent_destinations
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
          )
      `,
      [userId, maxRecentPerUser]
    );
  }

  return {
    listByUser,
    upsertByUser
  };
}

module.exports = { createRecentRepository };
