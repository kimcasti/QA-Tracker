export interface AppConfig {
  apiUrl: string;
  apiIdentifier: string;
  apiPassword: string;
  useServiceAuth: boolean;
}

const config: AppConfig = {
  apiUrl: (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, ''),
  apiIdentifier: (import.meta.env.VITE_API_IDENTIFIER || '').trim(),
  apiPassword: (import.meta.env.VITE_API_PASSWORD || '').trim(),
  useServiceAuth: import.meta.env.VITE_USE_SERVICE_AUTH === 'true',
};

export const { apiUrl, apiIdentifier, apiPassword, useServiceAuth } = config;

export default config;
