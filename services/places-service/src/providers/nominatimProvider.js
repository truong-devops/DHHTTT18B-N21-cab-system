const { toFiniteNumber } = require('../utils/normalize');

function normalizeLabelFromDisplayName(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return '';
  const [firstSegment] = raw.split(',');
  return String(firstSegment || raw).trim();
}

function buildSearchUrl({ baseUrl, query, limit, countryCodes }) {
  const url = new URL('/search', baseUrl);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');
  if (countryCodes) {
    url.searchParams.set('countrycodes', countryCodes);
  }
  return url;
}

function mapNominatimItem(item, index) {
  const displayName = String(item?.display_name || '').trim();
  const label = String(item?.name || normalizeLabelFromDisplayName(displayName)).trim();
  if (!label) return null;

  const lat = toFiniteNumber(item?.lat);
  const lng = toFiniteNumber(item?.lon);
  const placeId = String(item?.place_id || item?.osm_id || `nominatim-${index + 1}`);

  return {
    id: `nom-${placeId}`,
    label,
    address: displayName || label,
    lat,
    lng
  };
}

function createNominatimProvider({ baseUrl, timeoutMs, userAgent, countryCodes }) {
  async function search({ query, limit }) {
    const trimmed = String(query || '').trim();
    if (!trimmed) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = buildSearchUrl({ baseUrl, query: trimmed, limit, countryCodes });
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        return [];
      }

      return payload.map(mapNominatimItem).filter((item) => Boolean(item));
    } catch (_error) {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  return { search };
}

module.exports = { createNominatimProvider };
