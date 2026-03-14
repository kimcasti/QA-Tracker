import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider, theme, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import i18n, { type AppLanguage, LS_LANG_KEY } from './i18n';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useAppLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useAppLanguage must be used within <LanguageProvider>');
  return ctx;
}

const baseTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
  },
};

function readInitialLanguage(): AppLanguage {
  const saved = localStorage.getItem(LS_LANG_KEY) as AppLanguage | null;
  if (saved === 'es' || saved === 'en') return saved;
  const current = (i18n.language || 'es').slice(0, 2) as AppLanguage;
  return current === 'en' ? 'en' : 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => readInitialLanguage());

  useEffect(() => {
    localStorage.setItem(LS_LANG_KEY, language);
    i18n.changeLanguage(language);
    dayjs.locale(language === 'es' ? 'es' : 'en');
  }, [language]);

  const locale = useMemo(() => (language === 'es' ? esES : enUS), [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      <ConfigProvider theme={baseTheme} locale={locale}>
        {children}
      </ConfigProvider>
    </LanguageContext.Provider>
  );
}

