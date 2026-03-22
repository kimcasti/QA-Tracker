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
  roleLabel?: string;
  onLogout: () => void;
  onOpenNotes: () => void;
  notesActive?: boolean;
  isViewer?: boolean;
};

export function UserMenu({
  email,
  userDisplayName,
  userInitial,
  roleLabel,
  onLogout,
  onOpenNotes,
  notesActive = false,
  isViewer = false,
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
        className="flex w-[340px] max-w-[340px] items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-1.5 text-left transition hover:border-slate-200 hover:bg-white"
      >
        <Avatar size={36} className="shrink-0 bg-slate-900">
          {userInitial}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <div className="flex min-w-0 items-center gap-2">
            <Text strong className="truncate text-[13px]">
              {userDisplayName}
            </Text>
            {roleLabel ? (
              <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                {roleLabel}
              </span>
            ) : null}
          </div>
          <Text type="secondary" className="mt-0.5 truncate text-[11px]">
            {email}
          </Text>
        </div>
        <Space size={4} className="ml-auto shrink-0 text-xs text-slate-400">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
            {language}
          </span>
          <DownOutlined />
        </Space>
      </button>
    </Dropdown>
  );
}
