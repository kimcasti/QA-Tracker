import { DownOutlined, FileTextOutlined, GlobalOutlined, LogoutOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Dropdown, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppLanguage } from '../i18n/LanguageProvider';

const { Text } = Typography;

type UserMenuProps = {
  email: string;
  userDisplayName: string;
  userInitial: string;
  onLogout: () => void;
  onOpenNotes: () => void;
  notesActive?: boolean;
};

export function UserMenu({
  email,
  userDisplayName,
  userInitial,
  onLogout,
  onOpenNotes,
  notesActive = false,
}: UserMenuProps) {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppLanguage();

  const items: MenuProps['items'] = [
    {
      key: 'notes',
      icon: <FileTextOutlined />,
      label: 'Notas',
      disabled: notesActive,
      onClick: onOpenNotes,
    },
    {
      type: 'divider',
    },
    {
      key: 'language',
      icon: <GlobalOutlined />,
      label: 'Cambiar idioma',
      children: [
        {
          key: 'lang-es',
          label: t('language.es'),
          onClick: () => setLanguage('es'),
        },
        {
          key: 'lang-en',
          label: t('language.en'),
          onClick: () => setLanguage('en'),
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: onLogout,
    },
  ];

  return (
    <Dropdown menu={{ items, selectable: false }} trigger={['click']} placement="bottomRight">
      <button
        type="button"
        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-white"
      >
        <Avatar className="bg-slate-900">{userInitial}</Avatar>
        <div className="flex max-w-[220px] flex-col leading-none">
          <Text strong className="truncate">
            {userDisplayName}
          </Text>
          <Text type="secondary" className="truncate text-[11px]">
            {email}
          </Text>
        </div>
        <Space size={4} className="text-xs text-slate-400">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase">
            {language}
          </span>
          <DownOutlined />
        </Space>
      </button>
    </Dropdown>
  );
}
