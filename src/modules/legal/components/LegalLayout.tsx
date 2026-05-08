import { ArrowLeftOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { appBranding } from '../../../assets/branding';
import { qaBrand } from '../../../theme/palette';
import { PublicSiteFooter } from '../../public/components/PublicSiteFooter';
import { publicLegalLinks } from '../../public/utils/publicSiteLinks';
import type { LegalDocument } from '../content';
import { legalHighlights } from '../content';

const { Title, Text, Paragraph } = Typography;

type LegalLayoutProps = {
  document: LegalDocument;
};

export default function LegalLayout({ document }: LegalLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_56%,#ffffff_100%)] text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 md:py-6 xl:px-8">
        <header className="rounded-[30px] border border-slate-200/80 bg-white/90 px-5 py-5 shadow-[0_18px_42px_rgba(16,42,67,0.06)] backdrop-blur md:px-7 md:py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 no-underline transition hover:bg-white"
                >
                  <ArrowLeftOutlined />
                  Volver a QA Tracker
                </Link>

                <div className="mt-5 flex items-center gap-4">
                  <img
                    src={appBranding.logoUrl}
                    alt={qaBrand.name}
                    className="h-14 w-14 rounded-2xl border border-slate-100 object-cover shadow-sm"
                  />
                  <div>
                    <Text className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Legal
                    </Text>
                    <Title level={3} className="!mb-0 !mt-1 !text-slate-900">
                      {qaBrand.name}
                    </Title>
                  </div>
                </div>
              </div>

              <nav className="flex flex-wrap gap-2">
                {publicLegalLinks.map(item => {
                  const isActive = item.href === document.path;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`rounded-full px-4 py-2 text-sm font-semibold no-underline transition ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-[0_16px_30px_rgba(15,23,42,0.16)]'
                          : 'border border-slate-200 bg-white text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px] xl:items-start">
              <div className="max-w-3xl">
                <Text
                  className="inline-flex rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em]"
                  style={{
                    color: document.accentColor,
                    backgroundColor: `${document.accentColor}14`,
                  }}
                >
                  {document.navLabel}
                </Text>
                <Title
                  level={1}
                  className="!mb-0 !mt-5 !text-[clamp(2.3rem,4vw,4rem)] !leading-[0.98] !text-slate-950"
                >
                  {document.title}
                </Title>
                <Paragraph className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                  {document.description}
                </Paragraph>
                <Text className="block max-w-3xl text-sm leading-7 text-slate-500">
                  {document.summary}
                </Text>
              </div>

              <Card
                variant="borderless"
                className="overflow-hidden rounded-[28px] border border-white/80 bg-white/96 shadow-[0_24px_54px_rgba(16,42,67,0.08)]"
                styles={{ body: { padding: 24 } }}
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl"
                  style={{
                    color: document.accentColor,
                    background: `linear-gradient(135deg, ${document.accentColor}16 0%, rgba(255,255,255,1) 100%)`,
                  }}
                >
                  {document.icon}
                </div>
                <Text className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Resumen
                </Text>
                <Paragraph className="!mb-0 !mt-3 text-sm leading-7 text-slate-600">
                  {document.note}
                </Paragraph>
              </Card>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {legalHighlights.map(item => (
            <Card
              key={item.title}
              variant="borderless"
              className="rounded-[26px] border border-slate-200/80 bg-white/92 shadow-[0_14px_32px_rgba(16,42,67,0.05)]"
              styles={{ body: { padding: 22 } }}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-700">
                {item.icon}
              </div>
              <Title level={4} className="!mb-2 !text-slate-900">
                {item.title}
              </Title>
              <Text className="text-sm leading-7 text-slate-600">{item.description}</Text>
            </Card>
          ))}
        </section>

        <section className="grid gap-4">
          {document.sections.map((section, index) => (
            <Card
              key={section.title}
              variant="borderless"
              className="rounded-[28px] border border-slate-200/80 bg-white/96 shadow-[0_18px_42px_rgba(16,42,67,0.05)]"
              styles={{ body: { padding: 28 } }}
            >
              <div className="grid gap-5 lg:grid-cols-[92px_minmax(0,1fr)]">
                <div>
                  <Text
                    className="inline-flex rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]"
                    style={{
                      color: document.accentColor,
                      backgroundColor: `${document.accentColor}12`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </div>

                <div>
                  <Title level={3} className="!mb-3 !text-slate-900">
                    {section.title}
                  </Title>
                  <div className="grid gap-4">
                    {section.body.map(paragraph => (
                      <Paragraph
                        key={paragraph}
                        className="!mb-0 text-sm leading-8 text-slate-600 md:text-base"
                      >
                        {paragraph}
                      </Paragraph>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <PublicSiteFooter />
      </main>
    </div>
  );
}
