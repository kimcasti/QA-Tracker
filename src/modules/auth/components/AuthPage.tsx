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
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import authIllustrationUrl from '../../../assets/auth-qa-illustration.svg';
import { appBranding } from '../../../assets/branding';
import { PublicHttp, toApiError } from '../../../config/http';
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
  organizationName: string;
};

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

type InvitationContext = {
  documentId: string;
  email: string;
  organizationName: string;
  roleName: string;
  status: InvitationStatus;
};

const heroCopy = {
  login: {
    eyebrow: 'Acceso QA Tracker',
    title: 'Asegura la calidad.',
    description:
      'Retoma ciclos de regresión, revisa bugs y mantén a tu equipo alineado desde una organización QA clara y profesional.',
    accent: '#DCE8F8',
  },
  signup: {
    eyebrow: 'Crea tu organización',
    title: 'Lanza tu operación QA en minutos.',
    description:
      'Regístrate, crea tu organización y empieza a gestionar proyectos, casos de prueba, ejecuciones y reportes.',
    accent: '#D9F3FA',
  },
} as const;

const heroHighlights = [
  'Operación QA clara',
  'Organización + proyectos',
  'Reportes y trazabilidad',
] as const;

const showcaseStats = [
  { value: '1 organización', label: 'lista al registrarte' },
  { value: 'Roles + membresías', label: 'control de acceso real' },
  { value: 'Story map y ciclos', label: 'todo en una sola capa' },
] as const;

export default function AuthPage() {
  const { login, signup } = useAuthSession();
  const [loginForm] = Form.useForm<LoginValues>();
  const [signupForm] = Form.useForm<SignupValues>();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInvitationLoading, setIsInvitationLoading] = useState(false);
  const [invitationContext, setInvitationContext] = useState<InvitationContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invitationId = searchParams.get('invitation')?.trim() || '';
  const requestedMode = searchParams.get('mode');
  const hasPendingInvitation = invitationContext?.status === 'pending';
  const lockedFieldStyle = hasPendingInvitation
    ? {
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        cursor: 'not-allowed' as const,
      }
    : undefined;

  useEffect(() => {
    const searchMode = requestedMode === 'signup' || requestedMode === 'login' ? requestedMode : null;

    if (!invitationId) {
      setInvitationContext(null);
      setIsInvitationLoading(false);
      if (searchMode) {
        setMode(searchMode);
      }
      return;
    }

    let isCurrent = true;

    setIsInvitationLoading(true);
    setErrorMessage(null);

    PublicHttp.get(`/api/organization-team/invitations/${encodeURIComponent(invitationId)}/public`)
      .then(response => {
        if (!isCurrent) return;

        const payload = response.data?.data;
        const nextInvitation: InvitationContext = {
          documentId: String(payload?.documentId || invitationId),
          email: String(payload?.email || ''),
          organizationName: String(payload?.organization?.name || ''),
          roleName: String(payload?.role?.name || 'Viewer'),
          status: (payload?.status || 'pending') as InvitationStatus,
        };

        setInvitationContext(nextInvitation);
        loginForm.setFieldsValue({ identifier: nextInvitation.email });
        signupForm.setFieldsValue({
          email: nextInvitation.email,
          organizationName: nextInvitation.organizationName,
        });
        setMode(searchMode === 'login' ? 'login' : 'signup');
      })
      .catch(error => {
        if (!isCurrent) return;
        setInvitationContext(null);
        setErrorMessage(toApiError(error).message);
        if (searchMode) {
          setMode(searchMode);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsInvitationLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [invitationId, loginForm, requestedMode, signupForm]);

  useEffect(() => {
    if (!invitationContext) return;

    loginForm.setFieldValue('identifier', invitationContext.email);
    signupForm.setFieldsValue({
      email: invitationContext.email,
      organizationName: invitationContext.organizationName,
    });
  }, [invitationContext, loginForm, signupForm]);

  const activeCopy = useMemo(() => {
    if (hasPendingInvitation && invitationContext && mode === 'signup') {
      return {
        eyebrow: 'Invitación a organización',
        title: `Únete a ${invitationContext.organizationName}.`,
        description: `Crea tu acceso para colaborar como ${invitationContext.roleName} dentro de QA Tracker.`,
        accent: '#D9F3FA',
      };
    }

    if (hasPendingInvitation && invitationContext && mode === 'login') {
      return {
        eyebrow: 'Acceso por invitación',
        title: 'Entra con tu cuenta existente.',
        description: `Inicia sesión con ${invitationContext.email} para sumarte a ${invitationContext.organizationName}.`,
        accent: '#DCE8F8',
      };
    }

    return heroCopy[mode];
  }, [hasPendingInvitation, invitationContext, mode]);

  const panelCopy = useMemo(() => {
    if (mode === 'login') {
      if (hasPendingInvitation && invitationContext) {
        return {
          eyebrow: 'Accede a tu invitación',
          title: 'Inicia sesión',
          description: `Si ya tienes cuenta, entra con ${invitationContext.email} para aceptar el acceso a ${invitationContext.organizationName}.`,
          submitLabel: 'Entrar y unirme',
          helper: '¿Necesitas una cuenta? Cambia a Registro para completar tu acceso con esta invitación.',
        };
      }

      return {
        eyebrow: 'Acceso a QA Tracker',
        title: 'Inicia sesión',
        description: 'Usa tus credenciales de QA Tracker para continuar.',
        submitLabel: 'Entrar a QA Tracker',
        helper: '¿Necesitas una cuenta? Cambia a Registro y crea tu organización en un solo paso.',
      };
    }

    if (hasPendingInvitation && invitationContext) {
      return {
        eyebrow: 'Acepta tu invitación',
        title: 'Crea tu cuenta',
        description: `Completa tu usuario y contraseña para unirte a ${invitationContext.organizationName} como ${invitationContext.roleName}.`,
        submitLabel: 'Crear cuenta y unirme',
        helper: '¿Ya tienes una cuenta? Vuelve a Ingresar y usa el mismo correo invitado.',
      };
    }

    return {
      eyebrow: 'Provisiona tu organización',
      title: 'Crea tu cuenta',
      description: 'Crea tu usuario admin y aprovisionaremos una organización inicial para ti.',
      submitLabel: 'Crear organización',
      helper: '¿Ya te registraste? Vuelve a Ingresar y continúa con tu operación QA.',
    };
  }, [hasPendingInvitation, invitationContext, mode]);

  const invitationAlert = useMemo(() => {
    if (!invitationContext) return null;

    if (invitationContext.status === 'pending') {
      return {
        type: 'info' as const,
        message: `Invitación a ${invitationContext.organizationName}`,
        description: `${invitationContext.email} fue invitado como ${invitationContext.roleName}.`,
      };
    }

    const statusLabel =
      invitationContext.status === 'accepted'
        ? 'aceptada'
        : invitationContext.status === 'expired'
          ? 'expirada'
          : 'cancelada';

    return {
      type: 'warning' as const,
      message: `Invitación ${statusLabel}`,
      description: 'Puedes iniciar sesión o registrarte de forma normal si necesitas continuar.',
    };
  }, [invitationContext]);

  const signupInitialValues = useMemo(
    () => ({
      email: invitationContext?.email || '',
      organizationName: invitationContext?.organizationName || '',
    }),
    [invitationContext],
  );

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
                    Vista general de la organización
                  </Text>
                  <Title level={3} className="!mb-2 !mt-3 !text-slate-900">
                    Una entrada limpia para equipos que viven entre bugs, ciclos y trazabilidad.
                  </Title>
                  <Text className="block max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                    La ilustración y los bloques informativos ahora acompañan la acción principal
                    sin empujar el contenido hacia vacíos gigantes.
                  </Text>
                </div>
              </div>

              <img
                src={authIllustrationUrl}
                alt="Ilustración de organización QA Tracker"
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
                      {panelCopy.eyebrow}
                    </Text>
                    <Title level={2} className="!mb-2 !mt-3 !text-slate-900">
                      {panelCopy.title}
                    </Title>
                    <Text className="text-sm leading-6 text-slate-500">
                      {panelCopy.description}
                    </Text>
                  </div>

                  {isInvitationLoading ? (
                    <Alert
                      type="info"
                      showIcon
                      message="Validando invitación"
                      description="Estamos cargando los datos de la organización invitante."
                      className="mb-6 rounded-2xl"
                    />
                  ) : invitationAlert ? (
                    <Alert
                      type={invitationAlert.type}
                      showIcon
                      message={invitationAlert.message}
                      description={invitationAlert.description}
                      className="mb-6 rounded-2xl"
                    />
                  ) : null}

                  {errorMessage ? (
                    <Alert
                      type="error"
                      showIcon
                      message={errorMessage}
                      className="mb-6 rounded-2xl"
                    />
                  ) : null}

                  {mode === 'login' ? (
                    <Form
                      key={`login-${invitationContext?.documentId || 'default'}`}
                      form={loginForm}
                      layout="vertical"
                      onFinish={handleLogin}
                      size="large"
                      initialValues={{
                        identifier: invitationContext?.email || '',
                      }}
                    >
                      <Form.Item
                        name="identifier"
                        label="Correo o usuario"
                        rules={[{ required: true, message: 'Ingresa tu correo o tu usuario.' }]}
                      >
                        <Input
                          prefix={<UserOutlined className="text-slate-400" />}
                          placeholder="tu-correo@empresa.com"
                          className="h-12 rounded-2xl"
                          disabled={hasPendingInvitation}
                          style={lockedFieldStyle}
                        />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Contraseña"
                        rules={[{ required: true, message: 'Ingresa tu contraseña.' }]}
                      >
                        <Input.Password
                          prefix={<LockOutlined className="text-slate-400" />}
                          placeholder="Tu contraseña segura"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting || isInvitationLoading}
                        className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                      >
                        {panelCopy.submitLabel}
                      </Button>
                    </Form>
                  ) : (
                    <Form
                      key={`signup-${invitationContext?.documentId || 'default'}`}
                      form={signupForm}
                      layout="vertical"
                      onFinish={handleSignup}
                      size="large"
                      initialValues={signupInitialValues}
                    >
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
                        label="Correo electrónico"
                        rules={[
                          { required: true, message: 'Ingresa tu correo.' },
                          { type: 'email', message: 'Usa un correo válido.' },
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined className="text-slate-400" />}
                          placeholder="kimberly@empresa.com"
                          className="h-12 rounded-2xl"
                          disabled={hasPendingInvitation}
                          style={lockedFieldStyle}
                          value={hasPendingInvitation ? invitationContext?.email || '' : undefined}
                        />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="Contraseña"
                        rules={[
                          { required: true, message: 'Crea una contraseña.' },
                          { min: 6, message: 'Usa al menos 6 caracteres.' },
                        ]}
                      >
                        <Input.Password
                          prefix={<LockOutlined className="text-slate-400" />}
                          placeholder="Mínimo 6 caracteres"
                          className="h-12 rounded-2xl"
                        />
                      </Form.Item>
                      <Form.Item
                        name="organizationName"
                        label="Nombre de la organización"
                        rules={[{ required: true, message: 'Ingresa el nombre de tu organización.' }]}
                      >
                        <Input
                          prefix={<SafetyCertificateOutlined className="text-slate-400" />}
                          placeholder="Laboratorio QA Kimberly"
                          className="h-12 rounded-2xl"
                          disabled={hasPendingInvitation}
                          style={lockedFieldStyle}
                          value={
                            hasPendingInvitation
                              ? invitationContext?.organizationName || ''
                              : undefined
                          }
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting || isInvitationLoading}
                        className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                      >
                        {panelCopy.submitLabel}
                      </Button>
                    </Form>
                  )}

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                    {panelCopy.helper}
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
