export interface AppConfig {
  apiUrl: string;
  apiIdentifier: string;
  apiPassword: string;
  useServiceAuth: boolean;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  );
}

function resolveServiceAuthEnabled() {
  const requested = import.meta.env.VITE_USE_SERVICE_AUTH === 'true';

  if (!requested) {
    return false;
  }

  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return true;
  }

  console.warn(
    '[qa-tracker] VITE_USE_SERVICE_AUTH was ignored because service auth is disabled outside local development runtimes.',
  );
  return false;
}

const config: AppConfig = {
  apiUrl: (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, ''),
  apiIdentifier: (import.meta.env.VITE_API_IDENTIFIER || '').trim(),
  apiPassword: (import.meta.env.VITE_API_PASSWORD || '').trim(),
  useServiceAuth: resolveServiceAuthEnabled(),
};

export const { apiUrl, apiIdentifier, apiPassword, useServiceAuth } = config;

export default config;
