const redis = require('../cache/redis');

const QUOTE_PREFIX = 'quote:';

function buildKey(quoteId) {
  return `${QUOTE_PREFIX}${quoteId}`;
}

async function saveQuote(quoteId, quote, ttlSeconds) {
  const key = buildKey(quoteId);
  const payload = JSON.stringify(quote);
  await redis.set(key, payload, 'EX', ttlSeconds);
}

async function getQuote(quoteId) {
  const key = buildKey(quoteId);
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

module.exports = { saveQuote, getQuote };
