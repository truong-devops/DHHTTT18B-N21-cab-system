const crypto = require("crypto");
const { getDb } = require("../db/mongo");

function mapIdempotency(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc._id,
    idempotency_key: doc.idempotency_key,
    route_key: doc.route_key,
    user_id: doc.user_id,
    idem_key: doc.idem_key,
    request_hash: doc.request_hash,
    response_status: doc.response_status ?? null,
    response_headers: doc.response_headers ?? null,
    response_body: doc.response_body ?? null,
    locked_at: doc.locked_at ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    expires_at: doc.expires_at ?? null
  };
}

async function getByKey({ routeKey, userId, idempotencyKey }) {
  const db = await getDb();
  const doc = await db.collection("idempotency_keys").findOne({
    route_key: routeKey,
    user_id: userId,
    idem_key: idempotencyKey
  });
  return mapIdempotency(doc);
}

async function createKey({
  routeKey,
  userId,
  idempotencyKey,
  requestHash
}) {
  const db = await getDb();
  const now = new Date();

  const result = await db
    .collection("idempotency_keys")
    .findOneAndUpdate(
      {
        route_key: routeKey,
        user_id: userId,
        idem_key: idempotencyKey
      },
      {
        $set: {
          locked_at: now,
          updated_at: now
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          idempotency_key: idempotencyKey,
          route_key: routeKey,
          user_id: userId,
          idem_key: idempotencyKey,
          request_hash: requestHash,
          response_status: null,
          response_headers: null,
          response_body: null,
          created_at: now
        }
      },
      { upsert: true, returnDocument: "after" }
    );

  return mapIdempotency(result.value);
}

async function setResponse({
  routeKey,
  userId,
  idempotencyKey,
  responseStatus,
  responseHeaders,
  responseBody
}) {
  const db = await getDb();
  await db.collection("idempotency_keys").updateOne(
    {
      route_key: routeKey,
      user_id: userId,
      idem_key: idempotencyKey
    },
    {
      $set: {
        response_status: responseStatus,
        response_headers: responseHeaders || null,
        response_body: responseBody,
        locked_at: null,
        updated_at: new Date()
      }
    }
  );
}

module.exports = {
  getByKey,
  createKey,
  setResponse
};
