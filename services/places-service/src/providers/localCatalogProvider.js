const { PLACE_CATALOG } = require('../data/catalog');
const { normalizeText, toFiniteNumber } = require('../utils/normalize');

function haversineMeters(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

function scorePlace(place, normalizedQuery) {
  if (!normalizedQuery) return 1;

  const label = normalizeText(place.label);
  const address = normalizeText(place.address);
  const tags = normalizeText((place.tags || []).join(' '));
  const merged = `${label} ${address} ${tags}`.trim();

  if (label === normalizedQuery) return 12;
  if (label.startsWith(normalizedQuery)) return 10;
  if (label.includes(normalizedQuery)) return 7;
  if (address.includes(normalizedQuery)) return 5;
  if (normalizedQuery.split(' ').every((token) => merged.includes(token))) return 3;
  return 0;
}

function normalizeCoordinates(lat, lng) {
  const parsedLat = toFiniteNumber(lat);
  const parsedLng = toFiniteNumber(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function mapCatalogItem(place) {
  return {
    id: place.id,
    label: place.label,
    address: place.address,
    lat: place.lat,
    lng: place.lng
  };
}

function searchCatalog({ query, limit, lat, lng }) {
  const normalizedQuery = normalizeText(query);
  const coordinate = normalizeCoordinates(lat, lng);

  const results = PLACE_CATALOG.map((place) => {
    const score = scorePlace(place, normalizedQuery);
    const distance = coordinate ? haversineMeters(coordinate, { lat: place.lat, lng: place.lng }) : Number.POSITIVE_INFINITY;
    return { place, score, distance };
  })
    .filter((entry) => (normalizedQuery ? entry.score > 0 : true))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.place.label.localeCompare(b.place.label);
    })
    .slice(0, limit)
    .map((entry) => mapCatalogItem(entry.place));

  return results;
}

module.exports = { searchCatalog };
