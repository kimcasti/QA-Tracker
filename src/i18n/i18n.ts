import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export type AppLanguage = 'es' | 'en';
export const LS_LANG_KEY = 'qa_lang';

function detectInitialLanguage(): AppLanguage {
  const saved = localStorage.getItem(LS_LANG_KEY) as AppLanguage | null;
  if (saved === 'es' || saved === 'en') return saved;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
}

export function setAppLanguage(lang: AppLanguage) {
  localStorage.setItem(LS_LANG_KEY, lang);
  i18n.changeLanguage(lang);
}

// Initialize once (side-effect import from main.tsx).
i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: detectInitialLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

