import { Typography } from 'antd';
import { Link } from 'react-router-dom';
import { qaBrand } from '../../../theme/palette';
import { getPublicContactUrl, publicLegalLinks } from '../utils/publicSiteLinks';

const { Text } = Typography;

type PublicSiteFooterProps = {
  className?: string;
};

export function PublicSiteFooter({ className = '' }: PublicSiteFooterProps) {
  return (
    <footer
      className={`rounded-[28px] border border-slate-200/80 bg-white/88 px-5 py-5 shadow-[0_16px_36px_rgba(16,42,67,0.05)] backdrop-blur ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Text className="block text-sm font-semibold text-slate-900">{qaBrand.name}</Text>
          <Text className="text-sm text-slate-500">
            Operaci\u00f3n QA con trazabilidad, reportes t\u00e9cnicos e IA asistencial.
          </Text>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {publicLegalLinks.map(item => (
            <Link
              key={item.href}
              to={item.href}
              className="text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={getPublicContactUrl()}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900"
          >
            Contacto
          </a>
        </nav>
      </div>
    </footer>
  );
}
