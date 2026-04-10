import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_DESTINATIONS_KEY = 'customerApp.recentDestinations';
const RECENT_DESTINATIONS_LIMIT = 8;

function normalizeLabel(value: string) {
  return value.trim();
}

function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique: string[] = [];
  input.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = normalizeLabel(value);
    if (!normalized) return;
    const duplicated = unique.some((item) => item.toLowerCase() === normalized.toLowerCase());
    if (!duplicated) {
      unique.push(normalized);
    }
  });
  return unique.slice(0, RECENT_DESTINATIONS_LIMIT);
}

export async function listRecentDestinations() {
  const raw = await AsyncStorage.getItem(RECENT_DESTINATIONS_KEY);
  if (!raw) return [];
  try {
    return sanitizeList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function pushRecentDestination(label: string) {
  const nextLabel = normalizeLabel(label);
  if (!nextLabel) return listRecentDestinations();

  const current = await listRecentDestinations();
  const next = [nextLabel, ...current.filter((item) => item.toLowerCase() !== nextLabel.toLowerCase())].slice(0, RECENT_DESTINATIONS_LIMIT);
  await AsyncStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(next));
  return next;
}
