import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Segmented,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import authIllustrationUrl from '../../../assets/auth-qa-illustration.svg';
import { appBranding } from '../../../assets/branding';
import { toApiError } from '../../../config/http';
import { qaBrand, qaPalette } from '../../../theme/palette';
import { useAuthSession } from '../context/AuthSessionProvider';

const { Title, Text, Paragraph } = Typography;

type AuthMode = 'login' | 'signup';

type LoginValues = {
  identifier: string;
  password: string;
};

type SignupValues = {
  username: string;
  email: string;
  password: string;
  organizationName?: string;
};

const heroCopy = {
  login: {
    eyebrow: 'Acceso QA Tracker',
    title: 'Vuelve a tu centro de calidad.',
    description:
      'Retoma ciclos de regresion, revisa bugs y manten a tu equipo alineado desde un workspace QA claro y profesional.',
    accent: '#DCE8F8',
  },
  signup: {
    eyebrow: 'Crea tu workspace',
    title: 'Lanza tu laboratorio QA en minutos.',
    description:
      'Registrate, genera tu espacio automaticamente y empieza a organizar proyectos, casos de prueba, ejecuciones y reportes.',
    accent: '#D9F3FA',
  },
} as const;

const heroHighlights = [
  'Operacion QA clara',
  'Multiples workspaces',
  'Reportes y trazabilidad',
] as const;

const showcaseStats = [
  { value: '1 workspace', label: 'listo al registrarte' },
  { value: 'Roles + membresias', label: 'control de acceso real' },
  { value: 'Story map y ciclos', label: 'todo en una sola capa' },
] as const;

export default function AuthPage() {
  const { login, signup } = useAuthSession();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeCopy = heroCopy[mode];

  const handleLogin = async (values: LoginValues) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await login(values);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setErrorMessage(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (values: SignupValues) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await signup(values);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setErrorMessage(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden bg-[linear-gradient(135deg,#f7fbff_0%,#eef6fb_42%,#f8f1ec_100%)]">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1600px] items-center justify-center overflow-hidden p-4 lg:p-6">
        <div className="absolute inset-x-10 top-0 h-40 rounded-full bg-[radial-gradient(circle,_rgba(23,182,211,0.16)_0%,_rgba(23,182,211,0)_72%)] blur-2xl" />
        <div className="absolute -left-10 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(18,63,104,0.14)_0%,_rgba(18,63,104,0)_74%)] blur-3xl" />

        <section
          className="relative w-full overflow-hidden rounded-[36px] border border-white/70 bg-white/78 p-5 shadow-[0_32px_80px_rgba(16,42,67,0.14)] backdrop-blur md:p-7 lg:p-8"
          style={{
            backgroundImage: `radial-gradient(circle at top right, ${activeCopy.accent} 0%, rgba(255,255,255,0) 34%)`,
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_440px] lg:gap-8">
            <div className="min-w-0 space-y-6">
              <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/74 p-6 shadow-[0_22px_54px_rgba(16,42,67,0.08)] md:p-8">
                <div className="absolute right-[-72px] top-[-76px] h-56 w-56 rounded-full bg-[rgba(23,182,211,0.12)] blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-4">
                    <img
                      src={appBranding.logoUrl}
                      alt={qaBrand.name}
                      className="h-14 w-14 rounded-2xl border border-slate-100 object-cover shadow-md"
                    />
                    <div>
                      <Text className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                        {activeCopy.eyebrow}
                      </Text>
                      <Title level={1} className="!mb-0 !mt-1 max-w-3xl !text-[clamp(2rem,3.3vw,4.25rem)] !leading-[1.02] !text-slate-900">
                        {activeCopy.title}
                      </Title>
                    </div>
                  </div>

                  <Paragraph className="mt-5 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                    {activeCopy.description}
                  </Paragraph>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {heroHighlights.map((item) => (
                      <div
                        key={item}
                        className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-3 md:grid-cols-3">
                    {showcaseStats.map((item, index) => (
                      <div
                        key={item.label}
                        className="rounded-[24px] border border-slate-200/80 bg-white/84 px-4 py-4 shadow-[0_16px_30px_rgba(16,42,67,0.05)]"
                      >
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/5">
                          {index === 0 ? (
                            <UserOutlined style={{ color: qaPalette.primary }} />
                          ) : index === 1 ? (
                            <SafetyCertificateOutlined style={{ color: qaPalette.accent }} />
                          ) : (
                            <ArrowRightOutlined
                              style={{ color: qaPalette.functionalityStatus.completed }}
                            />
                          )}
                        </div>
                        <Text className="block text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {item.value}
                        </Text>
                        <Text className="mt-2 block text-sm leading-6 text-slate-600">
                          {item.label}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            <div className="relative overflow-hidden rounded-[32px] border border-[#d7e9f0] bg-[linear-gradient(135deg,rgba(18,63,104,0.05)_0%,rgba(23,182,211,0.12)_100%)] p-6 md:p-8">
              <div className="absolute -left-12 bottom-[-72px] h-56 w-56 rounded-full bg-[rgba(18,63,104,0.07)]" />
              <div className="absolute right-[-30px] top-[-18px] h-56 w-56 rounded-full bg-[rgba(23,182,211,0.11)]" />

              <div className="relative">
                <div>
                  <Text className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Vista general del workspace
                  </Text>
                  <Title level={3} className="!mb-2 !mt-3 !text-slate-900">
                    Una entrada limpia para equipos que viven entre bugs, ciclos y trazabilidad.
                  </Title>
                  <Text className="block max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                    La ilustracion y los bloques informativos ahora acompañan la accion principal
                    sin empujar el contenido hacia vacios gigantes.
                  </Text>
                </div>
              </div>

              <img
                src={authIllustrationUrl}
                alt="Ilustracion de workspace QA Tracker"
                className="relative mx-auto mt-6 max-h-[420px] w-full max-w-[780px] object-contain"
              />
            </div>
            </div>

            <div className="space-y-4">
              <Card
                variant="borderless"
                className="relative overflow-hidden rounded-[30px] border border-white/90 bg-white/92 shadow-[0_28px_72px_rgba(16,42,67,0.16)] lg:sticky lg:top-6"
                styles={{ body: { padding: 24 } }}
              >
                <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(23,182,211,0.10)_0%,rgba(23,182,211,0)_100%)]" />

                <div className="relative">
                  <div className="mb-6 rounded-[26px] border border-slate-200/80 bg-slate-100/90 p-1">
                    <Segmented<AuthMode>
                      block
                      value={mode}
                      options={[
                        { label: 'Ingresar', value: 'login' },
                        { label: 'Registro', value: 'signup' },
                      ]}
                      onChange={(value) => {
                        setMode(value);
                        setErrorMessage(null);
                      }}
                      className="rounded-full"
                    />
                  </div>

                  <div className="mb-6">
                    <Text className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      {mode === 'login' ? 'Acceso al workspace' : 'Provisiona tu espacio'}
                    </Text>
                    <Title level={2} className="!mb-2 !mt-3 !text-slate-900">
                      {mode === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'}
                    </Title>
                    <Text className="text-sm leading-6 text-slate-500">
                      {mode === 'login'
                        ? 'Usa tus credenciales de QA Tracker para continuar.'
                        : 'Crea tu usuario y aprovisionaremos un workspace inicial para ti.'}
                    </Text>
                  </div>

                  {errorMessage ? (
                    <Alert
                      type="error"
                      showIcon
                      message={errorMessage}
                      className="mb-6 rounded-2xl"
                    />
                  ) : null}

                  {mode === 'login' ? (
                    <Form layout="vertical" onFinish={handleLogin} size="large">
                      <Form.Item
                        name="identifier"
                        label="Correo o usuario"
                        rules={[{ required: true, message: 'Ingresa tu correo o tu usuario.' }]}
                      >
                        <Input
                          prefix={<UserOutlined className="text-slate-400" />}
                          placeholder="tu-correo@empresa.com"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Contrasena"
                        rules={[{ required: true, message: 'Ingresa tu contrasena.' }]}
                      >
                        <Input.Password
                          prefix={<LockOutlined className="text-slate-400" />}
                          placeholder="Tu contrasena segura"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting}
                        className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                      >
                        Entrar a QA Tracker
                      </Button>
                    </Form>
                  ) : (
                    <Form layout="vertical" onFinish={handleSignup} size="large">
                      <Form.Item
                        name="username"
                        label="Nombre de usuario"
                        rules={[{ required: true, message: 'Elige un nombre de usuario.' }]}
                      >
                        <Input
                          prefix={<UserOutlined className="text-slate-400" />}
                          placeholder="kimberly"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>
                      <Form.Item
                        name="email"
                        label="Correo electronico"
                        rules={[
                          { required: true, message: 'Ingresa tu correo.' },
                          { type: 'email', message: 'Usa un correo valido.' },
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined className="text-slate-400" />}
                          placeholder="kimberly@empresa.com"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Contrasena"
                        rules={[
                          { required: true, message: 'Crea una contrasena.' },
                          { min: 6, message: 'Usa al menos 6 caracteres.' },
                        ]}
                      >
                        <Input.Password
                          prefix={<LockOutlined className="text-slate-400" />}
                          placeholder="Minimo 6 caracteres"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>
                      <Form.Item name="organizationName" label="Nombre del workspace (opcional)">
                        <Input
                          prefix={<SafetyCertificateOutlined className="text-slate-400" />}
                          placeholder="Laboratorio QA Kimberly"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting}
                        className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                      >
                        Crear workspace
                      </Button>
                    </Form>
                  )}

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                    {mode === 'login'
                      ? 'Necesitas una cuenta? Cambia a Registro y crea tu workspace en un solo paso.'
                      : 'Ya te registraste? Vuelve a Ingresar y continua con tu operacion QA.'}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
