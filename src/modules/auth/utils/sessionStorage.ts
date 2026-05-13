const AUTH_STORAGE_AREA = 'sessionStorage';

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function readSessionValue(key: string) {
  return getSessionStorage()?.getItem(key) ?? null;
}

export function writeSessionValue(key: string, value: string | null) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (value === null) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, value);
}

export function clearLegacyLocalValue(key: string) {
  getLocalStorage()?.removeItem(key);
}

export function migrateLegacyLocalValue(key: string) {
  const currentSessionValue = readSessionValue(key);
  if (currentSessionValue) {
    clearLegacyLocalValue(key);
    return currentSessionValue;
  }

  const legacyValue = getLocalStorage()?.getItem(key) ?? null;
  if (!legacyValue) {
    return null;
  }

  writeSessionValue(key, legacyValue);
  clearLegacyLocalValue(key);
  return legacyValue;
}

export function getAuthStorageAreaLabel() {
  return AUTH_STORAGE_AREA;
}
