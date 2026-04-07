function encodeCursor({ createdAt, id }) {
  if (!createdAt || !id) {
    return null;
  }
  const createdAtValue = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  const raw = `${createdAtValue}|${id}`;
  return Buffer.from(raw, 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') {
    return null;
  }

  let decoded;
  try {
    decoded = Buffer.from(cursor, 'base64').toString('utf8');
  } catch (error) {
    return null;
  }

  const [createdAt, id] = decoded.split('|');
  if (!createdAt || !id) {
    return null;
  }

  return { createdAt, id };
}

function applyCursorQuery(queryBuilder, { limit = 20, cursor = null, sort = '-created_at' } = {}) {
  if (!queryBuilder || !Array.isArray(queryBuilder.values)) {
    throw new Error('applyCursorQuery requires values array');
  }
  if (!Array.isArray(queryBuilder.where)) {
    throw new Error('applyCursorQuery requires where array');
  }

  const sortValue = sort || '-created_at';
  const isDesc = sortValue === '-created_at' || sortValue === '-createdAt';
  const order = isDesc ? 'DESC' : 'ASC';

  if (cursor?.createdAt && cursor?.id) {
    queryBuilder.values.push(cursor.createdAt, cursor.id);
    const createdAtIndex = queryBuilder.values.length - 1;
    const idIndex = queryBuilder.values.length;
    queryBuilder.where.push(`(created_at, id) ${isDesc ? '<' : '>'} ($${createdAtIndex}, $${idIndex})`);
  }

  queryBuilder.orderBy = `created_at ${order}, id ${order}`;
  queryBuilder.limit = limit;

  return queryBuilder;
}

module.exports = {
  encodeCursor,
  decodeCursor,
  applyCursorQuery
};
