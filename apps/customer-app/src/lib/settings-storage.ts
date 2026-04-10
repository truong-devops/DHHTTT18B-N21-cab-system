import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_LOCATIONS_KEY = 'customerApp.savedLocations';
const PAYMENT_METHODS_KEY = 'customerApp.paymentMethods';
const APP_SETTINGS_KEY = 'customerApp.settings';

const MAX_SAVED_LOCATIONS = 20;
const MAX_PAYMENT_METHODS = 20;

export type SavedLocation = {
  id: string;
  label: string;
  address: string;
};

export type PaymentMethodType = 'CASH' | 'CARD' | 'WALLET' | 'VIETQR';

export type PaymentMethodItem = {
  id: string;
  type: PaymentMethodType;
  label: string;
  details?: string;
  isDefault: boolean;
};

export type AppSettings = {
  pushNotifications: boolean;
  promoNotifications: boolean;
  biometrics: boolean;
};

const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  {
    id: 'pm-cash',
    type: 'CASH',
    label: 'Tiền mặt',
    details: 'Thanh toán khi đến nơi',
    isDefault: true
  },
  {
    id: 'pm-wallet',
    type: 'WALLET',
    label: 'Ví',
    details: 'Ví nội bộ',
    isDefault: false
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  pushNotifications: true,
  promoNotifications: true,
  biometrics: false
};

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sanitizeSavedLocations(input: unknown): SavedLocation[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: SavedLocation[] = [];

  input.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = String((item as { id?: unknown }).id || '').trim();
    const label = String((item as { label?: unknown }).label || '').trim();
    const address = String((item as { address?: unknown }).address || '').trim();
    if (!id || !label || !address) return;
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ id, label, address });
  });

  return result.slice(0, MAX_SAVED_LOCATIONS);
}

function sanitizePaymentMethods(input: unknown): PaymentMethodItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: PaymentMethodItem[] = [];

  input.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = String((item as { id?: unknown }).id || '').trim();
    const type = String((item as { type?: unknown }).type || '').toUpperCase();
    const label = String((item as { label?: unknown }).label || '').trim();
    const details = String((item as { details?: unknown }).details || '').trim();
    const isDefault = Boolean((item as { isDefault?: unknown }).isDefault);

    if (!id || !label) return;
    if (!['CASH', 'CARD', 'WALLET', 'VIETQR'].includes(type)) return;
    if (seen.has(id)) return;
    seen.add(id);

    result.push({
      id,
      type: type as PaymentMethodType,
      label,
      details: details || undefined,
      isDefault
    });
  });

  if (!result.length) return [];

  if (!result.some((item) => item.isDefault)) {
    result[0] = { ...result[0], isDefault: true };
  } else {
    let hasDefault = false;
    for (let i = 0; i < result.length; i += 1) {
      if (result[i].isDefault && !hasDefault) {
        hasDefault = true;
      } else if (result[i].isDefault && hasDefault) {
        result[i] = { ...result[i], isDefault: false };
      }
    }
  }

  return result.slice(0, MAX_PAYMENT_METHODS);
}

function sanitizeSettings(input: unknown): AppSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS;
  return {
    pushNotifications: Boolean((input as { pushNotifications?: unknown }).pushNotifications),
    promoNotifications: Boolean((input as { promoNotifications?: unknown }).promoNotifications),
    biometrics: Boolean((input as { biometrics?: unknown }).biometrics)
  };
}

export async function listSavedLocations() {
  const data = safeJsonParse(await AsyncStorage.getItem(SAVED_LOCATIONS_KEY));
  return sanitizeSavedLocations(data);
}

export async function upsertSavedLocation(input: { id?: string; label: string; address: string }) {
  const label = input.label.trim();
  const address = input.address.trim();
  if (!label || !address) {
    throw new Error('Nhãn và địa chỉ là bắt buộc');
  }

  const id = (input.id || '').trim() || makeId('loc');
  const current = await listSavedLocations();
  const nextItem: SavedLocation = { id, label, address };
  const index = current.findIndex((item) => item.id === id);
  const next = [...current];
  if (index >= 0) {
    next[index] = nextItem;
  } else {
    next.unshift(nextItem);
  }

  const sanitized = sanitizeSavedLocations(next);
  await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function removeSavedLocation(id: string) {
  const current = await listSavedLocations();
  const next = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}

export async function listPaymentMethods() {
  const raw = safeJsonParse(await AsyncStorage.getItem(PAYMENT_METHODS_KEY));
  const parsed = sanitizePaymentMethods(raw);
  if (parsed.length) return parsed;
  await AsyncStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(DEFAULT_PAYMENT_METHODS));
  return DEFAULT_PAYMENT_METHODS;
}

export async function upsertPaymentMethod(input: {
  id?: string;
  type: PaymentMethodType;
  label: string;
  details?: string;
  isDefault?: boolean;
}) {
  const label = input.label.trim();
  if (!label) {
    throw new Error('Tên phương thức thanh toán là bắt buộc');
  }

  const id = (input.id || '').trim() || makeId('pm');
  const current = await listPaymentMethods();
  const index = current.findIndex((item) => item.id === id);
  const shouldDefault = Boolean(input.isDefault);

  const nextItem: PaymentMethodItem = {
    id,
    type: input.type,
    label,
    details: input.details?.trim() || undefined,
    isDefault: shouldDefault
  };

  let next = current.map((item) => (shouldDefault ? { ...item, isDefault: false } : item));
  if (index >= 0) {
    next[index] = nextItem;
  } else {
    next.unshift(nextItem);
  }

  const sanitized = sanitizePaymentMethods(next);
  await AsyncStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function removePaymentMethod(id: string) {
  const current = await listPaymentMethods();
  const next = current.filter((item) => item.id !== id);
  const sanitized = sanitizePaymentMethods(next);
  await AsyncStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function setDefaultPaymentMethod(id: string) {
  const current = await listPaymentMethods();
  const next = current.map((item) => ({
    ...item,
    isDefault: item.id === id
  }));
  const sanitized = sanitizePaymentMethods(next);
  await AsyncStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function getAppSettings() {
  const raw = safeJsonParse(await AsyncStorage.getItem(APP_SETTINGS_KEY));
  const parsed = sanitizeSettings(raw);
  return parsed;
}

export async function updateAppSettings(patch: Partial<AppSettings>) {
  const current = await getAppSettings();
  const next = sanitizeSettings({ ...current, ...patch });
  await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  return next;
}
