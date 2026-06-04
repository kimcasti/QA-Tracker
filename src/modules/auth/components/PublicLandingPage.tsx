import { Button, Drawer, Modal, Typography } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BugOutlined,
  CheckCircleFilled,
  CrownOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  MenuOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appBranding } from '../../../assets/branding';
import qaTrackerExplainer from '../../../assets/qa-tracker-explainer.png';
import { qaBrand, qaPalette } from '../../../theme/palette';
import { PublicSiteFooter } from '../../public/components/PublicSiteFooter';

const { Title, Text, Paragraph } = Typography;

const navItems = [
  { label: 'Producto', href: '#hero' },
  { label: 'Funciones', href: '#features' },
  { label: 'Precios', href: '#pricing' },
  { label: 'Clientes', href: '#testimonials' },
] as const;

const featureCards = [
  {
    icon: <FileSearchOutlined style={{ color: qaPalette.primary, fontSize: 22 }} />,
    title: 'Trazabilidad real',
    description: 'Conecta funcionalidades, casos, ejecuciones y bugs en una sola vista operativa.',
  },
  {
    icon: <BugOutlined style={{ color: '#6D5EF9', fontSize: 22 }} />,
    title: 'Menos caos',
    description: 'Deja atrás hojas sueltas, chats dispersos y decisiones sin contexto del proyecto.',
  },
  {
    icon: <BarChartOutlined style={{ color: qaPalette.accent, fontSize: 22 }} />,
    title: 'Decisiones con datos',
    description: 'Usa cobertura, reportes e insights para saber qué liberar y qué bloquear.',
  },
] as const;

const plans = [
  {
    name: 'Starter',
    badge: 'Empieza gratis',
    price: 'Gratis',
    icon: <LineChartOutlined style={{ color: qaPalette.primary, fontSize: 20 }} />,
    accentColor: qaPalette.primary,
    accentSurface: 'bg-slate-100',
    points: [
      '1 organización y hasta 3 proyectos',
      'Hasta 5 usuarios y 200 casos de prueba',
      'Reportes base y exportaciones limitadas',
    ],
    featured: false,
    cta: 'Probar gratis',
  },
  {
    name: 'Growth',
    badge: 'Recomendado',
    price: '$24.900 COP / mes',
    icon: <RocketOutlined style={{ color: '#6D5EF9', fontSize: 20 }} />,
    accentColor: '#6D5EF9',
    accentSurface: 'bg-[rgba(109,94,249,0.08)]',
    points: [
      'Hasta 15 proyectos y 25 usuarios',
      'IA con cupo mensual y reportes avanzados',
      'Exportaciones ampliadas y más capacidad operativa',
    ],
    featured: true,
    cta: 'Actualizar a Growth',
  },
  {
    name: 'Enterprise',
    badge: 'A medida',
    price: 'A medida',
    icon: <CrownOutlined style={{ color: '#D97706', fontSize: 20 }} />,
    accentColor: '#B45309',
    accentSurface: 'bg-[rgba(217,119,6,0.10)]',
    points: [
      'Límites personalizados para equipos grandes',
      'Mayor capacidad de IA y configuración guiada',
      'Soporte premium y acuerdos manuales',
    ],
    featured: false,
    cta: 'Hablar con ventas',
  },
] as const;

const testimonials = [
  {
    quote: 'Pasamos de coordinar QA en mensajes sueltos a tener una operación mucho más clara.',
    author: 'Keily Conde',
    role: 'QA Lead',
  },
  {
    quote: 'Lo mejor fue concentrar pruebas, bugs y reportes en un solo flujo sin perder contexto.',
    author: 'Kimberly Conde',
    role: 'QA Lead',
  },
  {
    quote:
      'La experiencia ha sido muy positiva: está muy bien automatizada, lo que reduce significativamente el tiempo de revisión. Además, su interfaz es bastante amigable, lo que facilita su uso en el día a día. En general, es una herramienta muy útil para optimizar nuestro trabajo de QA.',
    author: 'Jenipher Nassour',
    role: 'QA Engineer',
  },
] as const;

function DashboardPreview() {
  return (
    <div className="rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_rgba(16,42,67,0.08)] md:p-5">
      <div className="grid gap-4 xl:grid-cols-[170px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6D5EF9_0%,#8F7CFF_100%)] text-white">
              <BugOutlined />
            </div>
            <div>
              <Text className="block text-sm font-semibold text-slate-900">QA Tracker</Text>
              <Text className="block whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Workspace
              </Text>
            </div>
          </div>

          <div className="grid gap-2">
            {['Dashboard', 'Proyectos', 'Pruebas', 'Ejecución', 'Bugs', 'Reportes'].map(
              (item, index) => (
                <div
                  key={item}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                    index === 0 ? 'bg-[rgba(109,94,249,0.12)] text-[#6D5EF9]' : 'text-slate-500'
                  }`}
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Text className="block text-sm font-semibold text-slate-900">
                Resumen del proyecto
              </Text>
              <Text className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Últimos 7 días
              </Text>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              Growth
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['1,248', 'Casos'],
              ['632', 'Ejecuciones'],
              ['23', 'Bugs abiertos'],
              ['78%', 'Cobertura'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[22px] border border-slate-200/80 bg-white p-4">
                <Text className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {label}
                </Text>
                <Title level={3} className="!mb-0 !mt-3 !text-slate-900">
                  {value}
                </Title>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-5">
              <Text className="text-sm font-semibold text-slate-900">Ejecuciones por estado</Text>
              <div className="mx-auto mt-5 flex h-36 w-36 items-center justify-center rounded-full border-[16px] border-[rgba(23,182,211,0.14)] border-t-[rgba(109,94,249,0.75)] border-r-[rgba(20,155,139,0.65)]">
                <div className="text-center">
                  <Title level={3} className="!mb-0 !text-slate-900">
                    632
                  </Title>
                  <Text className="text-xs uppercase tracking-[0.14em] text-slate-400">Total</Text>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-5">
              <Text className="text-sm font-semibold text-slate-900">Evolución</Text>
              <div className="relative mt-4 h-44 rounded-[18px] bg-white p-3">
                <div className="absolute inset-x-3 top-8 border-t border-dashed border-slate-200" />
                <div className="absolute inset-x-3 top-20 border-t border-dashed border-slate-200" />
                <div className="absolute inset-x-3 top-32 border-t border-dashed border-slate-200" />
                <svg viewBox="0 0 360 160" className="h-full w-full">
                  <polyline
                    fill="none"
                    stroke="#17B6D3"
                    strokeWidth="4"
                    points="10,110 60,82 110,68 160,88 210,64 260,45 340,58"
                  />
                  <polyline
                    fill="none"
                    stroke="#6D5EF9"
                    strokeWidth="4"
                    points="10,124 60,90 110,106 160,80 210,98 260,72 340,52"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);

  const goToAuth = (mode: 'login' | 'signup') => {
    navigate(`/auth?mode=${mode}`);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f8fbff_0%,#f3f7fd_55%,#ffffff_100%)] text-slate-900">
      <div className="w-full">
        <header className="sticky top-3 z-20 rounded-[26px] border border-slate-200/80 bg-white/92 px-4 py-4 shadow-[0_18px_40px_rgba(16,42,67,0.05)] backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={appBranding.logoUrl}
                alt={qaBrand.name}
                className="h-11 w-11 rounded-2xl border border-slate-100 object-cover shadow-sm"
              />
              <div>
                <Title level={4} className="!mb-0 !text-slate-900">
                  {qaBrand.name}
                </Title>
                <Text className="text-sm text-slate-500">Operación QA con trazabilidad real</Text>
              </div>
            </div>

            <nav className="hidden items-center gap-6 xl:flex">
              {navItems.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-slate-900"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 xl:flex">
              <Button onClick={() => goToAuth('login')} className="rounded-full font-semibold">
                Iniciar sesión
              </Button>
              <Button
                type="primary"
                onClick={() => goToAuth('signup')}
                className="rounded-full font-semibold"
              >
                Probar gratis
                <ArrowRightOutlined />
              </Button>
            </div>

            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setIsMobileNavOpen(true)}
              className="xl:hidden"
            />
          </div>
        </header>

        <Drawer
          title={qaBrand.name}
          placement="right"
          open={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          width={320}
        >
          <div className="grid gap-3">
            {navItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 no-underline"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="mt-6 grid gap-3">
            <Button onClick={() => goToAuth('login')} className="h-11 rounded-2xl font-semibold">
              Iniciar sesión
            </Button>
            <Button
              type="primary"
              onClick={() => goToAuth('signup')}
              className="h-11 rounded-2xl font-semibold"
            >
              Probar gratis
            </Button>
          </div>
        </Drawer>

        <main className="space-y-8 px-4 pb-10 pt-6 md:space-y-10 md:px-8 md:pt-8 xl:px-10 2xl:px-14">
          <section
            id="hero"
            className="grid min-h-[calc(100dvh-132px)] gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-center"
          >
            <div className="max-w-2xl">
              <Text className="inline-flex rounded-full bg-[rgba(109,94,249,0.10)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#6D5EF9]">
                Plataforma QA para equipos modernos
              </Text>
              <Title
                level={1}
                className="!mb-0 !mt-5 !text-[clamp(2.7rem,5vw,5rem)] !leading-[0.96] !text-slate-950"
              >
                Centraliza tu QA y deja el caos atrás
              </Title>
              <Paragraph className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                Gestiona funcionalidades, pruebas, ejecuciones, bugs y reportes en un solo lugar.
                Menos hojas sueltas, más contexto para decidir.
              </Paragraph>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => goToAuth('signup')}
                  className="h-12 rounded-2xl px-6 font-semibold"
                >
                  Probar gratis ahora
                  <ArrowRightOutlined />
                </Button>
                <Button
                  size="large"
                  onClick={() => setIsExplainerOpen(true)}
                  className="h-12 rounded-2xl px-6 font-semibold"
                >
                  Ver cómo funciona
                  <PlayCircleOutlined />
                </Button>
              </div>

              <Text className="mt-4 block text-sm text-slate-500">
                Sin tarjeta de crédito. Configuración inicial en minutos.
              </Text>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ['Equipos eficientes', 'Menos tiempo perdido'],
                  ['Trazabilidad', 'Visibilidad real'],
                  ['Calidad', 'Mejores entregas'],
                ].map(([title, detail], index) => (
                  <div
                    key={title}
                    className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_30px_rgba(16,42,67,0.04)]"
                  >
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-white ${
                        index === 0
                          ? 'bg-[linear-gradient(135deg,#6D5EF9_0%,#8F7CFF_100%)]'
                          : index === 1
                            ? 'bg-[linear-gradient(135deg,#17B6D3_0%,#47D2EA_100%)]'
                            : 'bg-[linear-gradient(135deg,#149B8B_0%,#36C4B1_100%)]'
                      }`}
                    >
                      <CheckCircleFilled />
                    </div>
                    <Text className="block text-sm font-semibold text-slate-900">{title}</Text>
                    <Text className="mt-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
                      {detail}
                    </Text>
                  </div>
                ))}
              </div>
            </div>

            <DashboardPreview />
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_16px_38px_rgba(16,42,67,0.04)] md:px-6">
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              {['Equipos QA', 'Product Ops', 'Clinical Workflows', 'SaaS B2B'].map(item => (
                <div
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section
            id="features"
            className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
          >
            <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(18,63,104,0.04)_0%,rgba(255,255,255,1)_100%)] p-6 shadow-[0_18px_42px_rgba(16,42,67,0.05)] md:p-7">
              <Text className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                El problema
              </Text>
              <Title level={2} className="!mb-2 !mt-4 !text-slate-900">
                Tu QA no debería vivir entre Excel, chats y documentos sueltos.
              </Title>
              <Paragraph className="max-w-xl text-base leading-8 text-slate-600">
                QA Tracker ordena el flujo completo: alcance, casos, ejecuciones, bugs, cobertura y
                reportes. Todo queda conectado para que el equipo no pierda contexto.
              </Paragraph>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map(card => (
                <div
                  key={card.title}
                  className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_34px_rgba(16,42,67,0.05)]"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    {card.icon}
                  </div>
                  <Title level={4} className="!mb-2 !text-slate-900">
                    {card.title}
                  </Title>
                  <Text className="text-sm leading-7 text-slate-600">{card.description}</Text>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-[rgba(109,94,249,0.18)] bg-[linear-gradient(135deg,rgba(109,94,249,0.08)_0%,rgba(23,182,211,0.08)_100%)] p-6 shadow-[0_18px_40px_rgba(16,42,67,0.05)] md:p-7">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)] xl:items-center">
              <div>
                <Text className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#6D5EF9]">
                  Disponible en Growth
                </Text>
                <Title level={2} className="!mb-3 !mt-4 !text-slate-900">
                  Automatiza tu QA con IA
                </Title>
                <Paragraph className="max-w-xl text-base leading-7 text-slate-600">
                  Genera casos, recibe sugerencias inteligentes y mejora tus entregas con una capa
                  de IA integrada al flujo operativo, sin salir del workspace.
                </Paragraph>

                <div className="mt-5 grid gap-3">
                  {[
                    'Casos de prueba automáticos',
                    'Sugerencias inteligentes',
                    'Insights del proyecto',
                    'Reportes avanzados',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircleFilled style={{ color: '#6D5EF9', marginTop: 4 }} />
                      <Text className="text-sm leading-6 text-slate-600">{item}</Text>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-[28px] border border-white/80 bg-white/94 p-5 shadow-[0_16px_30px_rgba(16,42,67,0.06)]">
                  <Text className="text-sm font-semibold text-slate-900">Generar casos con IA</Text>
                  <div className="mt-4 grid gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <Text className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        Funcionalidad
                      </Text>
                      <Text className="mt-2 block text-sm leading-6 text-slate-700">
                        Como usuario quiero restablecer mi contraseña para recuperar el acceso.
                      </Text>
                    </div>
                    <Button
                      type="primary"
                      onClick={() => goToAuth('signup')}
                      className="h-11 rounded-2xl font-semibold"
                    >
                      Activar IA
                    </Button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/80 bg-white/94 p-5 shadow-[0_16px_30px_rgba(16,42,67,0.06)]">
                  <Text className="text-sm font-semibold text-slate-900">Casos generados</Text>
                  <Title level={2} className="!mb-1 !mt-4 !text-slate-900">
                    12
                  </Title>
                  <Text className="text-sm text-slate-500">Cobertura estimada 55%</Text>
                  <div className="mt-5 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-[linear-gradient(90deg,#17B6D3_0%,#6D5EF9_100%)]"
                      style={{ width: '55%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="pricing"
            className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(16,42,67,0.05)] md:p-7"
          >
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <Text className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Precios
                </Text>
                <Title level={2} className="!mb-1 !mt-4 !text-slate-900">
                  Empieza gratis. Escala cuando lo necesites.
                </Title>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map(plan => (
                <div
                  key={plan.name}
                  className={`rounded-[28px] border p-6 shadow-[0_16px_34px_rgba(16,42,67,0.05)] ${
                    plan.featured
                      ? 'border-[rgba(109,94,249,0.24)] bg-[linear-gradient(180deg,rgba(109,94,249,0.08)_0%,rgba(255,255,255,1)_32%)]'
                      : 'border-slate-200/80 bg-white'
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <Text
                        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${plan.accentSurface}`}
                        style={{ color: plan.accentColor }}
                      >
                        {plan.badge}
                      </Text>
                      <Title level={4} className="!mb-0 !mt-4 !text-slate-900">
                        {plan.name}
                      </Title>
                      {plan.name !== 'Growth' ? (
                        <Text
                          className="mt-1 block text-lg font-semibold"
                          style={{ color: plan.accentColor }}
                        >
                          {plan.price}
                        </Text>
                      ) : null}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                      {plan.icon}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {plan.points.map(point => (
                      <div key={point} className="flex items-start gap-3">
                        <CheckCircleFilled
                          style={{
                            color: plan.featured ? '#6D5EF9' : qaPalette.accent,
                            marginTop: 4,
                          }}
                        />
                        <Text className="text-sm leading-6 text-slate-600">{point}</Text>
                      </div>
                    ))}
                  </div>

                  <Button
                    type={plan.featured ? 'primary' : 'default'}
                    onClick={() => goToAuth(plan.name === 'Enterprise' ? 'login' : 'signup')}
                    className="mt-6 h-11 w-full rounded-2xl font-semibold"
                    icon={
                      plan.name === 'Growth' ? (
                        <MessageOutlined />
                      ) : plan.name === 'Enterprise' ? (
                        <SafetyCertificateOutlined />
                      ) : undefined
                    }
                    style={
                      plan.featured
                        ? {
                            background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                            border: 'none',
                          }
                        : undefined
                    }
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(18,63,104,0.04)_0%,rgba(255,255,255,1)_100%)] p-6 shadow-[0_18px_40px_rgba(16,42,67,0.05)] md:p-7">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <Text className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Upgrade simple
                </Text>
                <Title level={2} className="!mb-1 !mt-4 !text-slate-900">
                  Actualiza sin fricción cuando tu equipo lo necesite.
                </Title>
              </div>
              <Text className="text-sm text-slate-500">
                Sin pagos automáticos al inicio. Primero vende, luego automatizas.
              </Text>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {[
                {
                  step: '1',
                  title: 'Llegas al límite',
                  description:
                    'Cuando tu equipo necesita más proyectos, IA o reportes, la app te avisa con tiempo.',
                },
                {
                  step: '2',
                  title: 'Pides upgrade',
                  description:
                    'Haces clic en actualizar y se abre WhatsApp con el mensaje listo para continuar.',
                },
                {
                  step: '3',
                  title: 'Confirmas pago',
                  description:
                    'Puedes manejar transferencia, Nequi o acuerdo manual mientras validas el cobro.',
                },
                {
                  step: '4',
                  title: 'Se activa Growth',
                  description:
                    'Superadmin actualiza el plan y tu organización sigue creciendo sin interrupciones.',
                },
              ].map(item => (
                <div
                  key={item.step}
                  className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(16,42,67,0.04)]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(109,94,249,0.10)] text-lg font-black text-[#6D5EF9]">
                    {item.step}
                  </div>
                  <Title level={4} className="!mb-2 !text-slate-900">
                    {item.title}
                  </Title>
                  <Text className="text-sm leading-7 text-slate-600">{item.description}</Text>
                </div>
              ))}
            </div>
          </section>

          <section
            id="testimonials"
            className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(16,42,67,0.05)] md:p-7"
          >
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <Text className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Testimonios
                </Text>
                <Title level={2} className="!mb-1 !mt-4 !text-slate-900">
                  Equipos que ya están ordenando su operación QA
                </Title>
              </div>
              <Text className="text-sm text-slate-500">
                Menos ruido. Más trazabilidad. Mejor visibilidad.
              </Text>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {testimonials.map(item => (
                <div
                  key={`${item.author}-${item.role}`}
                  className="rounded-[28px] border border-slate-200/80 bg-slate-50 p-6"
                >
                  <Paragraph className="!mb-6 text-sm leading-7 text-slate-600">
                    "{item.quote}"
                  </Paragraph>
                  <div>
                    <Text className="block text-sm font-semibold text-slate-900">
                      {item.author}
                    </Text>
                    <Text className="text-xs uppercase tracking-[0.12em] text-slate-400">
                      {item.role}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] bg-[linear-gradient(135deg,#6D5EF9_0%,#2E83F2_100%)] px-6 py-7 text-white shadow-[0_26px_60px_rgba(46,131,242,0.24)] md:px-8 md:py-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <Title level={2} className="!mb-2 !text-white">
                  Empieza a organizar tu QA hoy
                </Title>
                <Text className="text-base leading-7 text-white/85">
                  Configura tu primer proyecto en minutos y entra a una operación mucho más clara.
                </Text>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="large"
                  onClick={() => goToAuth('signup')}
                  className="h-12 rounded-2xl border-white bg-white px-6 font-semibold text-slate-900"
                >
                  Probar gratis ahora
                  <ArrowRightOutlined />
                </Button>
                <Button
                  size="large"
                  onClick={() => goToAuth('login')}
                  className="h-12 rounded-2xl border-white/40 bg-transparent px-6 font-semibold text-white"
                >
                  Iniciar sesión
                </Button>
              </div>
            </div>
          </section>

          <PublicSiteFooter />
        </main>

        <Modal
          open={isExplainerOpen}
          onCancel={() => setIsExplainerOpen(false)}
          footer={null}
          centered
          destroyOnHidden
          width="min(1400px, calc(100vw - 32px))"
          className="[&_.ant-modal-content]:overflow-hidden [&_.ant-modal-content]:rounded-[28px] [&_.ant-modal-content]:p-0 [&_.ant-modal-content]:shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
          closeIcon={<span className="text-xl text-slate-400">×</span>}
        >
          <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,1)_100%)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 md:px-7">
              <div>
                <Text className="inline-flex rounded-full bg-[rgba(109,94,249,0.10)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#6D5EF9]">
                  Vista guiada
                </Text>
                <Title level={4} className="!mb-0 !mt-2 !text-slate-900">
                  Así funciona QA Tracker
                </Title>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-auto p-3 md:p-5">
              <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(16,42,67,0.08)]">
                <img
                  src={qaTrackerExplainer}
                  alt="Diagrama explicativo del flujo de QA Tracker"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
