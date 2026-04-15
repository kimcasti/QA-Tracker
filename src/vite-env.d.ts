/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_IDENTIFIER?: string;
  readonly VITE_API_PASSWORD?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_UPGRADE_WHATSAPP_PHONE?: string;
  readonly VITE_USE_SERVICE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
