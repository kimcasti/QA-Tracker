/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_IDENTIFIER?: string;
  readonly VITE_API_PASSWORD?: string;
  readonly VITE_USE_SERVICE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
