import { Alert, Button, Card, Form, Input, Segmented, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { appBranding } from '../../../assets/branding';
import { PublicHttp, toApiError } from '../../../config/http';
import { qaBrand, qaPalette } from '../../../theme/palette';
import { PublicSiteFooter } from '../../public/components/PublicSiteFooter';
import { useAuthSession } from '../context/AuthSessionProvider';
import { requestPasswordReset, resetPassword } from '../services/authService';

const { Title, Text } = Typography;

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

type LoginValues = {
  identifier: string;
  password: string;
};

type SignupValues = {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  contactNumber: string;
  organizationName: string;
};

type ForgotPasswordValues = {
  email: string;
};

type ResetPasswordValues = {
  password: string;
  passwordConfirmation: string;
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
    title: 'Vuelve a tu centro de calidad.',
    description:
      'Entra a tu workspace para continuar con proyectos, pruebas, bugs, reportes y decisiones operativas.',
  },
  signup: {
    eyebrow: 'Crea tu organización',
    title: 'Empieza a operar tu QA con estructura.',
    description:
      'Registra tu equipo, crea tu primera organización y entra a un flujo más claro desde el primer proyecto.',
  },
  'forgot-password': {
    eyebrow: 'Recupera tu acceso',
    title: 'Te ayudamos a volver a entrar.',
    description:
      'Ingresa tu correo y te enviaremos un enlace seguro para crear una nueva contraseña.',
  },
  'reset-password': {
    eyebrow: 'Nueva contraseña',
    title: 'Crea una contraseña nueva.',
    description: 'Usa una contraseña segura para recuperar tu acceso y volver a tu workspace.',
  },
} as const;

const marketingPoints = [
  'Trazabilidad real entre funcionalidades, pruebas y bugs',
  'Workspace centralizado para QA, producto y coordinación',
  'Starter gratis y Growth con IA, reportes avanzados y más capacidad',
] as const;

export default function AuthPage() {
  const { login, signup } = useAuthSession();
  const [loginForm] = Form.useForm<LoginValues>();
  const [signupForm] = Form.useForm<SignupValues>();
  const [forgotPasswordForm] = Form.useForm<ForgotPasswordValues>();
  const [resetPasswordForm] = Form.useForm<ResetPasswordValues>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInvitationLoading, setIsInvitationLoading] = useState(false);
  const [invitationContext, setInvitationContext] = useState<InvitationContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const invitationId = searchParams.get('invitation')?.trim() || '';
  const requestedMode = searchParams.get('mode');
  const resetCode = searchParams.get('code')?.trim() || '';
  const isResetPasswordRoute = location.pathname === '/reset-password';
  const hasPendingInvitation = invitationContext?.status === 'pending';
  const lockedFieldStyle = hasPendingInvitation
    ? {
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        cursor: 'not-allowed' as const,
      }
    : undefined;

  useEffect(() => {
    const searchMode =
      requestedMode === 'signup' || requestedMode === 'login' || requestedMode === 'forgot-password'
        ? requestedMode
        : null;

    if (!invitationId) {
      setInvitationContext(null);
      setIsInvitationLoading(false);
      if (isResetPasswordRoute) {
        setMode('reset-password');
      } else if (searchMode) {
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
        if (isResetPasswordRoute) {
          setMode('reset-password');
        } else if (searchMode) {
          setMode(searchMode);
        }
      })
      .finally(() => {
        if (isCurrent) setIsInvitationLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [invitationId, isResetPasswordRoute, loginForm, requestedMode, signupForm]);

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
      };
    }

    if (hasPendingInvitation && invitationContext && mode === 'login') {
      return {
        eyebrow: 'Acceso por invitación',
        title: 'Entra con tu cuenta existente.',
        description: `Inicia sesión con ${invitationContext.email} para sumarte a ${invitationContext.organizationName}.`,
      };
    }

    return heroCopy[mode];
  }, [hasPendingInvitation, invitationContext, mode]);

  const panelCopy = useMemo(() => {
    if (mode === 'forgot-password') {
      return {
        eyebrow: 'Recuperación por correo',
        title: 'Recupera tu contraseña',
        description: 'Te enviaremos un enlace de recuperación al correo asociado a tu cuenta.',
        submitLabel: 'Enviar enlace de recuperación',
        helper:
          'Si el correo existe en QA Tracker, recibirás instrucciones para restablecer tu contraseña.',
      };
    }

    if (mode === 'reset-password') {
      return {
        eyebrow: 'Restablecer acceso',
        title: 'Define tu nueva contraseña',
        description:
          'Crea una contraseña nueva para volver a entrar a tu workspace de forma segura.',
        submitLabel: 'Guardar nueva contraseña',
        helper:
          'Cuando la actualices, podrás iniciar sesión con tu nueva contraseña desde la pantalla principal.',
      };
    }

    if (mode === 'login') {
      if (hasPendingInvitation && invitationContext) {
        return {
          eyebrow: 'Accede a tu invitación',
          title: 'Inicia sesión',
          description: `Si ya tienes cuenta, entra con ${invitationContext.email} para aceptar el acceso a ${invitationContext.organizationName}.`,
          submitLabel: 'Entrar y unirme',
          helper:
            'Necesitas una cuenta? Cambia a Registro para completar tu acceso con esta invitación.',
        };
      }

      return {
        eyebrow: 'Acceso a QA Tracker',
        title: 'Inicia sesión',
        description: 'Usa tus credenciales para continuar con tu workspace.',
        submitLabel: 'Entrar a QA Tracker',
        helper: 'Necesitas una cuenta? Cambia a Registro y crea tu organización en un solo paso.',
      };
    }

    if (hasPendingInvitation && invitationContext) {
      return {
        eyebrow: 'Acepta tu invitación',
        title: 'Crea tu cuenta',
        description: `Completa tu usuario y contraseña para unirte a ${invitationContext.organizationName} como ${invitationContext.roleName}.`,
        submitLabel: 'Crear cuenta y unirme',
        helper: 'Ya tienes una cuenta? Vuelve a Ingresar y usa el mismo correo invitado.',
      };
    }

    return {
      eyebrow: 'Provisiona tu organización',
      title: 'Crea tu cuenta',
      description: 'Crea tu usuario admin y aprovisionaremos una organización inicial para ti.',
      submitLabel: 'Crear organización',
      helper: 'Ya te registraste? Vuelve a Ingresar y continúa con tu operación QA.',
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
      contactNumber: '',
      organizationName: invitationContext?.organizationName || '',
    }),
    [invitationContext],
  );

  const accessHelpAlert = useMemo(() => {
    if (!errorMessage) return null;

    if (errorMessage.includes('Tu organización está inactiva')) {
      return {
        title: 'Organización inactiva',
        description:
          'El acceso del equipo está suspendido temporalmente. Un superadmin debe volver a activar la organización para retomar el trabajo.',
      };
    }

    if (errorMessage.includes('Tu membresía está inactiva')) {
      return {
        title: 'Membresía inactiva',
        description:
          'Tu cuenta existe, pero tu acceso individual fue desactivado. Pide a un administrador de la organización que reactive tu membresía.',
      };
    }

    return null;
  }, [errorMessage]);

  const isStandardAuthMode = mode === 'login' || mode === 'signup';

  const handleLogin = async (values: LoginValues) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
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
      setSuccessMessage(null);
      await signup(values);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setErrorMessage(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (values: ForgotPasswordValues) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await requestPasswordReset(values);
      setSuccessMessage(
        'Si encontramos una cuenta con ese correo, te enviaremos un enlace para recuperar tu contraseña.',
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setErrorMessage(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (values: ResetPasswordValues) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      if (!resetCode) {
        throw new Error(
          'El enlace de recuperación no es válido o ya no contiene el código requerido.',
        );
      }

      await resetPassword({
        code: resetCode,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      });

      setSuccessMessage('Tu contraseña fue actualizada. Ahora puedes iniciar sesión con la nueva.');
      resetPasswordForm.resetFields();
      navigate('/auth?mode=login', { replace: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setErrorMessage(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(135deg,#f7fbff_0%,#eef5ff_42%,#fbf8ff_100%)] px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex min-h-[calc(100dvh-24px)] w-full max-w-[1800px] flex-col gap-4 md:min-h-[calc(100dvh-32px)]">
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-[36px] border border-white/80 bg-white/82 shadow-[0_34px_90px_rgba(16,42,67,0.14)] backdrop-blur lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#f3f8ff_0%,#edf4ff_42%,#f5f1ff_100%)] p-8 text-slate-900 lg:flex lg:flex-col lg:justify-between xl:p-10">
          <div className="absolute left-[-60px] top-[-40px] h-60 w-60 rounded-full bg-[rgba(109,94,249,0.10)] blur-3xl" />
          <div className="absolute bottom-[-80px] right-[-40px] h-72 w-72 rounded-full bg-[rgba(23,182,211,0.12)] blur-3xl" />

          <div className="relative">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/78 px-4 py-2 text-sm font-semibold text-slate-600 no-underline backdrop-blur transition hover:bg-white"
            >
              <ArrowLeftOutlined />
              Volver a la landing
            </Link>

            <div className="mt-10 flex items-center gap-4">
              <img
                src={appBranding.logoUrl}
                alt={qaBrand.name}
                className="h-14 w-14 rounded-2xl border border-white/90 object-cover shadow-md"
              />
              <div>
                <Title level={3} className="!mb-0 !text-slate-900">
                  {qaBrand.name}
                </Title>
                <Text className="text-slate-500">Workspace de calidad para equipos modernos.</Text>
              </div>
            </div>

            <Text className="mt-12 inline-flex rounded-full bg-[rgba(109,94,249,0.10)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#6D5EF9]">
              {activeCopy.eyebrow}
            </Text>
            <Title
              level={1}
              className="!mb-0 !mt-5 !text-[clamp(2.5rem,4vw,4.5rem)] !leading-[0.98] !text-slate-950"
            >
              {activeCopy.title}
            </Title>
            <Text className="mt-6 block max-w-xl text-base leading-8 text-slate-600 xl:text-lg">
              {activeCopy.description}
            </Text>

            <div className="mt-8 grid gap-3">
              {marketingPoints.map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircleFilled style={{ color: qaPalette.accent, marginTop: 4 }} />
                  <Text className="text-sm leading-6 text-slate-600">{item}</Text>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[28px] border border-slate-200/80 bg-white/74 p-6 backdrop-blur">
            <Text className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Lo que ganas
            </Text>
            <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ['Casos y ejecuciones', 'más conectados'],
                ['Bugs y cobertura', 'más claros'],
                ['Decisiones y reportes', 'más rápidos'],
              ].map(([title, detail]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4"
                >
                  <Text className="block text-sm font-semibold text-slate-800">{title}</Text>
                  <Text className="mt-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
                    {detail}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12">
          <Card
            variant="borderless"
            className="w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/90 bg-white/96 shadow-[0_28px_72px_rgba(16,42,67,0.12)]"
            styles={{ body: { padding: 28 } }}
          >
            <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
              <div className="flex items-center gap-3">
                <img
                  src={appBranding.logoUrl}
                  alt={qaBrand.name}
                  className="h-11 w-11 rounded-2xl border border-slate-100 object-cover shadow-md"
                />
                <div>
                  <Text className="block text-sm font-semibold text-slate-900">{qaBrand.name}</Text>
                  <Text className="text-xs text-slate-500">Acceso dedicado</Text>
                </div>
              </div>
              <Link to="/" className="text-sm font-semibold text-slate-500 no-underline">
                Volver
              </Link>
            </div>

            {isStandardAuthMode ? (
              <div className="mb-6 rounded-[26px] border border-slate-200/80 bg-slate-100/90 p-1">
                <Segmented<AuthMode>
                  block
                  value={mode}
                  options={[
                    { label: 'Ingresar', value: 'login' },
                    { label: 'Registro', value: 'signup' },
                  ]}
                  onChange={value => {
                    setMode(value);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="rounded-full"
                />
              </div>
            ) : (
              <Button
                type="text"
                className="mb-4 h-auto px-0 text-sm font-semibold text-slate-500"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  if (!successMessage) {
                    setSuccessMessage(null);
                  }
                  navigate('/auth?mode=login', { replace: true });
                }}
              >
                <ArrowLeftOutlined />
                Volver al inicio de sesión
              </Button>
            )}

            <div className="mb-6">
              <Text className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                {panelCopy.eyebrow}
              </Text>
              <Title level={2} className="!mb-2 !mt-3 !text-slate-900">
                {panelCopy.title}
              </Title>
              <Text className="text-sm leading-6 text-slate-500">{panelCopy.description}</Text>
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
                message={accessHelpAlert?.title || errorMessage}
                description={accessHelpAlert?.description}
                className="mb-6 rounded-2xl"
              />
            ) : null}

            {successMessage ? (
              <Alert
                type="success"
                showIcon
                message={successMessage}
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
                <div className="mb-4 flex justify-end">
                  <Button
                    type="link"
                    className="h-auto px-0 text-sm font-semibold"
                    onClick={() => {
                      setMode('forgot-password');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      forgotPasswordForm.setFieldsValue({
                        email: String(loginForm.getFieldValue('identifier') || ''),
                      });
                      navigate('/auth?mode=forgot-password', { replace: true });
                    }}
                  >
                    Olvidé mi contraseña
                  </Button>
                </div>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isSubmitting || isInvitationLoading}
                  className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                >
                  {panelCopy.submitLabel}
                </Button>

                <Text className="mt-4 block text-center text-xs leading-6 text-slate-500">
                  Al continuar aceptas los{' '}
                  <Link to="/terminos" className="font-semibold text-slate-700 no-underline">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" className="font-semibold text-slate-700 no-underline">
                    Política de Privacidad
                  </Link>{' '}
                  de QA Tracker.
                </Text>
              </Form>
            ) : mode === 'forgot-password' ? (
              <Form
                form={forgotPasswordForm}
                layout="vertical"
                onFinish={handleForgotPassword}
                size="large"
              >
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
                    placeholder="tu-correo@empresa.com"
                    className="h-12 rounded-2xl"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isSubmitting}
                  className="mt-2 h-12 w-full rounded-2xl text-base font-semibold"
                >
                  {panelCopy.submitLabel}
                </Button>
              </Form>
            ) : mode === 'reset-password' ? (
              <Form
                form={resetPasswordForm}
                layout="vertical"
                onFinish={handleResetPassword}
                size="large"
              >
                <Form.Item
                  name="password"
                  label="Nueva contraseña"
                  rules={[
                    { required: true, message: 'Ingresa tu nueva contraseña.' },
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
                  name="passwordConfirmation"
                  label="Confirma tu nueva contraseña"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Confirma tu nueva contraseña.' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }

                        return Promise.reject(new Error('Las contraseñas no coinciden.'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-slate-400" />}
                    placeholder="Repite la nueva contraseña"
                    className="h-12 rounded-2xl"
                  />
                </Form.Item>

                {!resetCode ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Enlace incompleto"
                    description="Este enlace no incluye un código válido de recuperación. Solicita uno nuevo desde el inicio de sesión."
                    className="mb-4 rounded-2xl"
                  />
                ) : null}

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isSubmitting}
                  disabled={!resetCode}
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
                    placeholder="Maria"
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
                    placeholder="maria@empresa.com"
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
                  name="passwordConfirmation"
                  label="Confirmar contraseña"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Confirma tu contraseña.' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }

                        return Promise.reject(new Error('Las contraseñas no coinciden.'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-slate-400" />}
                    placeholder="Repite tu contraseña"
                    className="h-12 rounded-2xl"
                  />
                </Form.Item>
                <Form.Item
                  name="contactNumber"
                  label="Número de contacto"
                  rules={[
                    { required: true, message: 'Ingresa tu número de contacto.' },
                    {
                      pattern: /^[0-9+\s()-]{7,20}$/,
                      message: 'Usa un número de contacto válido.',
                    },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined className="text-slate-400" />}
                    placeholder="+57 300 123 4567"
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
                    placeholder="Organización QA"
                    className="h-12 rounded-2xl"
                    disabled={hasPendingInvitation}
                    style={lockedFieldStyle}
                    value={
                      hasPendingInvitation ? invitationContext?.organizationName || '' : undefined
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

                <Text className="mt-4 block text-center text-xs leading-6 text-slate-500">
                  Al continuar aceptas los{' '}
                  <Link to="/terminos" className="font-semibold text-slate-700 no-underline">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" className="font-semibold text-slate-700 no-underline">
                    Política de Privacidad
                  </Link>{' '}
                  de QA Tracker.
                </Text>
              </Form>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
              {panelCopy.helper}
            </div>
          </Card>
        </section>
        </div>

        <PublicSiteFooter />
      </div>
    </div>
  );
}
