import { GlobalOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppLanguage } from './LanguageProvider';

export function LanguageSwitcher({ size }: { size?: 'small' | 'middle' | 'large' }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppLanguage();

  return (
    <Select
      value={language}
      size={size || 'middle'}
      onChange={(v) => setLanguage(v)}
      options={[
        { value: 'es', label: t('language.es') },
        { value: 'en', label: t('language.en') },
      ]}
      suffixIcon={<GlobalOutlined />}
      className="min-w-[140px]"
    />
  );
}

