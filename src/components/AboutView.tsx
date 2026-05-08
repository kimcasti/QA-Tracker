import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  BulbOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  CrownOutlined,
  EditOutlined,
  FileTextOutlined,
  FlagOutlined,
  MessageOutlined,
  MinusOutlined,
  PlusOutlined,
  ProfileOutlined,
  RobotOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useBugs } from '../modules/bugs/hooks/useBugs';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useMeetingNotes } from '../modules/meeting-notes/hooks/useMeetingNotes';
import { ParticipantSelect } from '../modules/participant-directory/components/ParticipantSelect';
import { useParticipantDirectoryMembers } from '../modules/participant-directory/hooks/useParticipantDirectoryMembers';
import { createExternalParticipant } from '../modules/participant-directory/services/participantDirectoryService';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import {
  buildProjectUpgradeWhatsAppUrl,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  BugStatus,
  ProjectStatus,
  type MeetingNote,
  type Project,
  type ProjectServiceBillingItem,
  type ProjectServiceBillingMode,
  type ProjectServiceBillingPhase,
  type ProjectServiceBillingSupportReport,
} from '../types';
import { qaPalette, softSurface } from '../theme/palette';
import { readFileAsDataUrl, validateInlineImageFile } from '../utils/uploadValidation';

const { Title, Text, Paragraph } = Typography;

type AboutViewProps = {
  project: Project;
};

const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  [ProjectStatus.ACTIVE]: { label: 'Activo', color: qaPalette.functionalityStatus.completed },
  [ProjectStatus.PAUSED]: { label: 'Pausado', color: qaPalette.functionalityStatus.inProgress },
  [ProjectStatus.COMPLETED]: { label: 'Completado', color: qaPalette.primary },
};

const BILLING_MODE_OPTIONS: Array<{ label: string; value: ProjectServiceBillingMode }> = [
  { label: 'Mensual', value: 'monthly' },
  { label: 'Total fase', value: 'phase_total' },
  { label: 'Pago unico', value: 'one_time' },
];

function createPhaseId() {
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createServiceId() {
  return `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCurrencyValue(value: unknown) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : undefined;
}

function normalizeServiceBillingItem(
  value?: Partial<ProjectServiceBillingItem> | null,
): ProjectServiceBillingItem {
  const supportReportValue = value?.supportReport as ProjectServiceBillingSupportReport | undefined;
  const supportReport = {
    title: String(supportReportValue?.title || '').trim() || undefined,
    summary: String(supportReportValue?.summary || '').trim() || undefined,
    referenceUrl: String(supportReportValue?.referenceUrl || '').trim() || undefined,
  };

  return {
    id: String(value?.id || createServiceId()),
    serviceName: String(value?.serviceName || '').trim(),
    relatedProcesses: Array.isArray(value?.relatedProcesses)
      ? value!.relatedProcesses
          .map(item => String(item || '').trim())
          .filter(Boolean)
      : [],
    billingMode:
      value?.billingMode === 'phase_total' || value?.billingMode === 'one_time'
        ? value.billingMode
        : 'monthly',
    monthlyCost: normalizeCurrencyValue(value?.monthlyCost),
    totalCost: normalizeCurrencyValue(value?.totalCost),
    supportReport:
      supportReport.title || supportReport.summary || supportReport.referenceUrl
        ? supportReport
        : undefined,
  };
}

function normalizeServiceBillingPhase(
  value?: Partial<ProjectServiceBillingPhase> | null,
): ProjectServiceBillingPhase {
  return {
    id: String(value?.id || createPhaseId()),
    phaseName: String(value?.phaseName || '').trim(),
    description: String(value?.description || '').trim() || undefined,
    services: Array.isArray(value?.services)
      ? value!.services
          .map(item => normalizeServiceBillingItem(item))
          .filter(item => item.serviceName || item.relatedProcesses.length || item.monthlyCost || item.totalCost)
      : [],
  };
}

function normalizeProjectServiceBillingPhases(value?: Project['serviceBillingPhases']) {
  return Array.isArray(value)
    ? value
        .map(item => normalizeServiceBillingPhase(item))
        .filter(phase => phase.phaseName || phase.description || phase.services.length > 0)
    : [];
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getBillingModeLabel(value: ProjectServiceBillingMode) {
  return BILLING_MODE_OPTIONS.find(option => option.value === value)?.label || 'Mensual';
}

function splitBusinessRules(value?: string) {
  return (value || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function splitAiBullets(value?: string) {
  return String(value || '')
    .split('\n')
    .map(item => item.replace(/^[\-\u2022]\s*/, '').trim())
    .filter(Boolean);
}

function buildMeetingAiPreviewText(input: {
  summary?: string;
  decisions?: string;
  actions?: string;
  nextSteps?: string;
}) {
  const sections = [
    input.summary?.trim() ? input.summary.trim() : null,
    splitAiBullets(input.decisions).length
      ? `Decisiones:\n${splitAiBullets(input.decisions)
          .map(item => `- ${item}`)
          .join('\n')}`
      : null,
    splitAiBullets(input.actions).length
      ? `Acciones:\n${splitAiBullets(input.actions)
          .map(item => `- ${item}`)
          .join('\n')}`
      : null,
    splitAiBullets(input.nextSteps).length
      ? `Próximos pasos\n${splitAiBullets(input.nextSteps)
          .map(item => `- ${item}`)
          .join('\n')}`
      : null,
  ].filter(Boolean);

  return sections.join('\n\n');
}

function getInitials(value: string) {
  return value
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}

function formatMeetingNoteDate(value?: string) {
  if (!value) return 'Sin fecha';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD MMM YYYY') : value;
}

function getMeetingParticipantCountLabel(value?: string) {
  const count = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean).length;

  if (count === 0) return 'Sin participantes';
  return `${count} participante${count === 1 ? '' : 's'}`;
}

function getMeetingPreview(value?: string) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  return compact || 'Sin notas registradas.';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchMatch(value: string, query: string) {
  const source = String(value || '');
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return source;
  }

  const expression = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig');
  const segments = source.split(expression);

  return segments.map((segment, index) =>
    segment.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() ? (
      <mark
        key={`${segment}-${index}`}
        className="rounded bg-amber-100 px-1 py-0.5 text-inherit"
      >
        {segment}
      </mark>
    ) : (
      <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>
    ),
  );
}

function getMeetingNoteSortValue(note: Pick<MeetingNote, 'date' | 'time'>) {
  const date = String(note.date || '').trim();
  const time = String(note.time || '').trim() || '00:00';
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const parsed = dayjs(`${date}T${normalizedTime}`);

  if (parsed.isValid()) {
    return parsed.valueOf();
  }

  const parsedDateOnly = dayjs(date);
  return parsedDateOnly.isValid() ? parsedDateOnly.valueOf() : 0;
}

function SurfaceCard({
  title,
  icon,
  accent,
  children,
  extra,
  extraBelow,
  stackHeader = false,
  className = '',
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  extraBelow?: React.ReactNode;
  stackHeader?: boolean;
  className?: string;
}) {
  return (
    <Card
      variant="borderless"
      className={`rounded-[28px] qa-surface-card ${className}`.trim()}
      styles={{ body: { padding: 24 } }}
    >
      <div className="mb-5">
        <div
          className={`gap-3 ${
            stackHeader ? 'flex flex-col items-stretch' : 'flex items-start justify-between'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <IconBadge accent={accent}>{icon}</IconBadge>
            <div className="min-w-0 flex-1">
              <Title level={4} className="!mb-0 !text-slate-900">
                {title}
              </Title>
            </div>
          </div>
          {!stackHeader ? extra : null}
        </div>
        {stackHeader ? <div className="mt-3 flex justify-end">{extraBelow || extra}</div> : null}
      </div>
      {children}
    </Card>
  );
}

function IconBadge({
  accent,
  children,
  className = '',
}: {
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm ${className}`.trim()}
      style={{
        color: accent,
        borderColor: softSurface(accent),
        boxShadow: `0 14px 30px ${softSurface(accent)}`,
      }}
    >
      {children}
    </div>
  );
}

function MetricPill({
  label,
  value,
  accent,
  className = '',
}: {
  label: string;
  value: number | string;
  accent: string;
  className?: string;
}) {
  const compactLabelLength = label.replace(/\s+/g, '').length;
  const isSingleWord = !/\s/.test(label.trim());

  const labelStyle: React.CSSProperties =
    compactLabelLength >= 15
      ? { fontSize: 9, letterSpacing: '0.08em', lineHeight: 1.25 }
      : compactLabelLength >= 12
        ? { fontSize: 10, letterSpacing: '0.12em', lineHeight: 1.25 }
        : { fontSize: 11, letterSpacing: '0.18em', lineHeight: 1.25 };

  return (
    <div
      className={`rounded-[22px] border px-4 py-3 ${className}`.trim()}
      style={{
        borderColor: softSurface(accent),
        background: `linear-gradient(135deg, ${softSurface(accent)} 0%, rgba(255,255,255,0.96) 100%)`,
      }}
    >
      <Text
        className={`block min-h-[2.4em] font-bold uppercase text-slate-400 ${
          isSingleWord ? 'whitespace-nowrap' : 'whitespace-normal'
        }`}
        style={labelStyle}
      >
        {label}
      </Text>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function HeaderActionButton({
  icon,
  label,
  accent,
  onClick,
  loading = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      icon={!loading ? icon : undefined}
      className="h-11 rounded-2xl border px-4 font-semibold shadow-none"
      style={{
        color: accent,
        borderColor: softSurface(accent),
        background: `linear-gradient(135deg, ${softSurface(accent)} 0%, rgba(255,255,255,0.96) 100%)`,
      }}
    >
      {label}
    </Button>
  );
}

function AiUpgradeBanner({
  title = 'Funciones IA disponibles en Growth',
  description = 'Desbloquea análisis del proyecto y briefs de wireframe para trabajar más rápido y con más claridad.',
  ctaLabel = 'Actualizar a Growth',
  compact = false,
  onViewPlans,
  onUpgradeGrowth,
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  compact?: boolean;
  onViewPlans: () => void;
  onUpgradeGrowth: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[rgba(245,158,11,0.45)] bg-[linear-gradient(135deg,rgba(255,248,230,0.92)_0%,rgba(255,255,255,0.98)_38%,rgba(255,251,235,0.92)_100%)] px-5 py-4 shadow-[0_18px_40px_rgba(245,158,11,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[rgba(251,191,36,0.10)] text-amber-500">
            <span className="text-[28px] leading-none">⚡</span>
          </div>

          <div className="min-w-0 flex-1">
            <Title
              level={4}
              className={`!text-slate-900 ${compact ? '!mb-0 !text-[13px] !font-normal !leading-5' : '!mb-1'}`}
            >
              {title}
            </Title>
            {!compact ? (
              <Paragraph className="!mb-0 max-w-3xl text-base leading-7 text-slate-600">
                {description}
              </Paragraph>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={onViewPlans}
            className="h-12 rounded-[20px] border-slate-200 bg-white px-6 font-semibold text-slate-700 shadow-sm"
          >
            Ver planes
          </Button>
          <Button
            type="primary"
            onClick={onUpgradeGrowth}
            className="h-12 rounded-[20px] border-0 px-6 font-semibold !text-white shadow-[0_12px_28px_rgba(59,130,246,0.20)]"
            style={{
              background: 'linear-gradient(135deg, #1E5FAF 0%, #1DA9CF 100%)',
              color: '#FFFFFF',
              border: '1px solid rgba(29,169,207,0.9)',
            }}
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconActionButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className="ml-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-transparent p-0"
    >
      {children}
    </button>
  );
}

export default function AboutView({ project }: AboutViewProps) {
  const queryClient = useQueryClient();
  const showServiceBillingSection = false;
  const { isViewer, activeMembership, projectQuota, canUseAi } = useWorkspaceAccess();
  const { save: saveProject, isSaving } = useProjects();
  const { data: functionalities = [], isLoading: isLoadingFunctionalities } = useFunctionalities(
    project.id,
  );
  const { data: testCases = [], isLoading: isLoadingTestCases } = useTestCases(project.id);
  const { data: bugs = [], isLoading: isLoadingBugs } = useBugs(project.id);
  const {
    data: meetingNotes = [],
    isLoading: isLoadingNotes,
    save: saveMeetingNote,
  } = useMeetingNotes(project.id);
  const { data: participantDirectoryMembers = [], isLoading: isParticipantDirectoryLoading } =
    useParticipantDirectoryMembers(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isMeetingHistoryOpen, setIsMeetingHistoryOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [isSavingMeetingNote, setIsSavingMeetingNote] = useState(false);
  const [isImprovingMeetingNotes, setIsImprovingMeetingNotes] = useState(false);
  const [editingMeetingNote, setEditingMeetingNote] = useState<MeetingNote | null>(null);
  const [meetingSearchTerm, setMeetingSearchTerm] = useState('');
  const [meetingFilterDate, setMeetingFilterDate] = useState<string | null>(null);
  const [activeAiAction, setActiveAiAction] = useState<'analysis' | 'brief' | null>(null);
  const [openAiDetail, setOpenAiDetail] = useState<'analysis' | 'brief' | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(project.logo);
  const [projectForm] = Form.useForm();
  const [meetingNoteForm] = Form.useForm();
  const watchedMeetingParticipants = Form.useWatch('participants', meetingNoteForm) as
    | string[]
    | undefined;
  const watchedMeetingAiSummary = Form.useWatch('aiSummary', meetingNoteForm) as string | undefined;
  const watchedMeetingAiDecisions = Form.useWatch('aiDecisions', meetingNoteForm) as
    | string
    | undefined;
  const watchedMeetingAiActions = Form.useWatch('aiActions', meetingNoteForm) as string | undefined;
  const watchedMeetingAiNextSteps = Form.useWatch('aiNextSteps', meetingNoteForm) as
    | string
    | undefined;

  const businessRules = useMemo(
    () => splitBusinessRules(project.businessRules),
    [project.businessRules],
  );
  const serviceBillingPhases = useMemo(
    () => normalizeProjectServiceBillingPhases(project.serviceBillingPhases),
    [project.serviceBillingPhases],
  );
  const serviceBillingSummary = useMemo(() => {
    const phaseCount = serviceBillingPhases.length;
    const serviceCount = serviceBillingPhases.reduce((total, phase) => total + phase.services.length, 0);
    const monthlyCost = serviceBillingPhases.reduce(
      (total, phase) =>
        total +
        phase.services.reduce((phaseTotal, service) => phaseTotal + (service.monthlyCost || 0), 0),
      0,
    );
    const totalCost = serviceBillingPhases.reduce(
      (total, phase) =>
        total + phase.services.reduce((phaseTotal, service) => phaseTotal + (service.totalCost || 0), 0),
      0,
    );

    return { phaseCount, serviceCount, monthlyCost, totalCost };
  }, [serviceBillingPhases]);
  const meetingParticipantExtraOptions = useMemo(
    () => (watchedMeetingParticipants || []).map(value => ({ label: value, value })),
    [watchedMeetingParticipants],
  );
  const meetingAiPreview = useMemo(
    () => ({
      summary: watchedMeetingAiSummary,
      decisions: splitAiBullets(watchedMeetingAiDecisions),
      actions: splitAiBullets(watchedMeetingAiActions),
      nextSteps: splitAiBullets(watchedMeetingAiNextSteps),
    }),
    [
      watchedMeetingAiActions,
      watchedMeetingAiDecisions,
      watchedMeetingAiNextSteps,
      watchedMeetingAiSummary,
    ],
  );
  const meetingAiPreviewText = useMemo(
    () =>
      buildMeetingAiPreviewText({
        summary: watchedMeetingAiSummary,
        decisions: watchedMeetingAiDecisions,
        actions: watchedMeetingAiActions,
        nextSteps: watchedMeetingAiNextSteps,
      }),
    [
      watchedMeetingAiActions,
      watchedMeetingAiDecisions,
      watchedMeetingAiNextSteps,
      watchedMeetingAiSummary,
    ],
  );
  const sortedMeetingNotes = useMemo(
    () =>
      [...meetingNotes].sort(
        (left, right) => getMeetingNoteSortValue(right) - getMeetingNoteSortValue(left),
      ),
    [meetingNotes],
  );
  const filteredMeetingNotes = useMemo(() => {
    const normalizedSearch = meetingSearchTerm.trim().toLocaleLowerCase();

    return sortedMeetingNotes.filter(note => {
      const matchesDate = !meetingFilterDate || note.date === meetingFilterDate;
      if (!matchesDate) return false;

      if (!normalizedSearch) return true;

      const searchableText = [note.title, note.notes]
        .map(value => String(value || '').toLocaleLowerCase())
        .join(' ');

      return searchableText.includes(normalizedSearch);
    });
  }, [meetingFilterDate, meetingSearchTerm, sortedMeetingNotes]);
  const statusMeta = STATUS_META[project.status] || STATUS_META[ProjectStatus.ACTIVE];
  const activeOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.plan || activeMembership?.organization?.plan,
  );
  const effectiveOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.effectivePlan || projectQuota?.plan || activeMembership?.organization?.plan,
  );
  const activeOrganizationName = activeMembership?.organization?.name;
  const projectUsageCount = projectQuota?.usage?.projects ?? projectQuota?.currentCount ?? 0;
  const projectLimit = projectQuota?.limits?.projects ?? projectQuota?.limit ?? 3;
  const upgradePriceMonthlyUsd = projectQuota?.upgradePriceMonthlyUsd ?? 5;
  const aiUpgradeUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName: activeOrganizationName,
    currentCount: projectUsageCount,
    limit: projectLimit,
    upgradePriceMonthlyUsd,
  });

  const stats = useMemo(() => {
    const activeBugs = bugs.filter(bug => bug.status !== BugStatus.RESOLVED).length;
    const latestMeetingDate =
      sortedMeetingNotes.length > 0
        ? [...sortedMeetingNotes]
            .map(note => note.date)
            .filter(Boolean)
            .sort((left, right) => right.localeCompare(left))[0]
        : null;

    const completedDocs = [
      Boolean(project.description?.trim()),
      Boolean(project.purpose?.trim()),
      Boolean(project.coreRequirements?.length),
      Boolean(businessRules.length),
      sortedMeetingNotes.length > 0,
      Boolean(project.aiProjectInsights?.trim()),
      Boolean(project.aiWireframeBrief?.trim()),
    ].filter(Boolean).length;

    const documentationScore = Math.round((completedDocs / 7) * 100);

    return {
      activeBugs,
      latestMeetingDate,
      documentationScore,
      participants: project.teamMembers?.length || 0,
      notes: sortedMeetingNotes.length,
      functionalities: functionalities.length,
      testCases: testCases.length,
    };
  }, [
    bugs,
    businessRules.length,
    functionalities.length,
    project.aiProjectInsights,
    project.aiWireframeBrief,
    project.coreRequirements,
    project.description,
    project.purpose,
    sortedMeetingNotes,
    project.teamMembers,
    testCases.length,
  ]);

  const isLoading =
    isLoadingFunctionalities || isLoadingTestCases || isLoadingBugs || isLoadingNotes;

  useEffect(() => {
    setLogoPreview(project.logo);
    projectForm.setFieldsValue({
      name: project.name,
      description: project.description,
      version: project.version,
      status: project.status,
      purpose: project.purpose,
      teamMembers: project.teamMembers || [],
      coreRequirements: (project.coreRequirements || []).join('\n'),
      businessRules: project.businessRules || '',
      serviceBillingPhases,
    });
  }, [project, projectForm, serviceBillingPhases]);

  const handleOpenEdit = () => {
    setLogoPreview(project.logo);
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setLogoPreview(project.logo);
    projectForm.resetFields();
  };

  const openMeetingModal = (note?: MeetingNote) => {
    const participants = note?.participants
      ? note.participants
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      : project.teamMembers || [];

    meetingNoteForm.setFieldsValue({
      title: note?.title || '',
      date: note?.date || dayjs().format('YYYY-MM-DD'),
      time: note?.time || dayjs().format('HH:mm'),
      participants,
      notes: note?.notes || '',
      aiSummary: note?.aiSummary || '',
      aiDecisions: note?.aiDecisions || '',
      aiActions: note?.aiActions || '',
      aiNextSteps: note?.aiNextSteps || '',
    });
    if (note) {
      setIsMeetingHistoryOpen(false);
    }
    setEditingMeetingNote(note || null);
    setIsMeetingModalOpen(true);
  };

  const closeMeetingModal = () => {
    setIsMeetingModalOpen(false);
    setEditingMeetingNote(null);
    meetingNoteForm.resetFields();
  };

  const persistProjectLogo = async (nextLogo?: string) => {
    setIsSavingLogo(true);

    try {
      await saveProject({
        ...project,
        logo: nextLogo,
      });
      return true;
    } catch (error) {
      console.error('Failed to persist project logo:', error);
      return false;
    } finally {
      setIsSavingLogo(false);
    }
  };

  const ensureAiProvider = async () => {
    if (!canUseAi) {
      setIsUpgradeModalOpen(true);
      message.warning('Las funciones IA en esta vista están disponibles en el plan Growth.');
      return false;
    }

    const { hasAiProviderConfigured } = await import('../services/geminiService');
    if (!hasAiProviderConfigured()) {
      message.warning(
        'Configura VITE_GEMINI_API_KEY o VITE_GROQ_API_KEY en el .env del cliente para usar la generación con IA.',
      );
      return false;
    }

    return true;
  };

  const handleUpgradeClick = async (source: string) => {
    try {
      const { startUpgradeRequestFlow } = await import('../modules/plans/services/billingService');
      await startUpgradeRequestFlow({
        requestedPlan: 'growth',
        source,
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: upgradePriceMonthlyUsd,
        contactUrl: aiUpgradeUrl,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'No pudimos iniciar la solicitud de upgrade.',
      );
    }
  };

  const handleEnterpriseClick = async () => {
    try {
      const { startUpgradeRequestFlow } = await import('../modules/plans/services/billingService');
      await startUpgradeRequestFlow({
        requestedPlan: 'enterprise',
        source: 'about-view-upgrade-modal-enterprise',
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: null,
        contactUrl: aiUpgradeUrl,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'No pudimos iniciar la solicitud de upgrade.',
      );
    }
  };

  const buildProjectAiInput = () => ({
    name: project.name,
    description: project.description,
    purpose: project.purpose,
    coreRequirements: project.coreRequirements || [],
    businessRules: project.businessRules || '',
  });

  const handleGenerateProjectAnalysis = async () => {
    if (!(await ensureAiProvider())) return;

    setActiveAiAction('analysis');
    try {
      const { analyzeProjectWithAI } = await import('../services/geminiService');
      const aiProjectInsights = await analyzeProjectWithAI(buildProjectAiInput(), project.id);
      await saveProject({ ...project, aiProjectInsights });
      message.success('Análisis del proyecto generado con IA');
    } catch (error) {
      console.error('Failed to generate project analysis:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos generar el análisis del proyecto.',
      );
    } finally {
      setActiveAiAction(null);
    }
  };

  const handleGenerateWireframeBrief = async () => {
    if (!(await ensureAiProvider())) return;

    setActiveAiAction('brief');
    try {
      const { generateProjectWireframeBrief } = await import('../services/geminiService');
      const aiWireframeBrief = await generateProjectWireframeBrief(
        buildProjectAiInput(),
        project.id,
      );
      await saveProject({ ...project, aiWireframeBrief });
      message.success('Brief de wireframe generado con IA');
    } catch (error) {
      console.error('Failed to generate wireframe brief:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos generar el brief de wireframe.',
      );
    } finally {
      setActiveAiAction(null);
    }
  };

  const activeAiDetailTitle =
    openAiDetail === 'analysis' ? 'Análisis del proyecto con IA' : 'Brief de wireframe con IA';
  const activeAiDetailContent =
    openAiDetail === 'analysis' ? project.aiProjectInsights : project.aiWireframeBrief;

  const handleCopyAiDetail = async () => {
    if (!activeAiDetailContent?.trim()) return;

    try {
      await navigator.clipboard.writeText(activeAiDetailContent);
      message.success('Contenido copiado');
    } catch (error) {
      console.error('Failed to copy AI detail:', error);
      message.error('No pudimos copiar el contenido.');
    }
  };

  const handleImproveMeetingNotes = async () => {
    if (!(await ensureAiProvider())) return;

    try {
      const values = await meetingNoteForm.validateFields(['notes']);
      const rawNotes = String(values.notes || '').trim();

      if (!rawNotes) {
        message.warning('Escribe las notas base antes de pedir ayuda a la IA.');
        return;
      }

      setIsImprovingMeetingNotes(true);
      const { improveMeetingNotesWithAI } = await import('../services/geminiService');
      const aiResult = await improveMeetingNotesWithAI(rawNotes, project.id);

      meetingNoteForm.setFieldsValue({
        aiSummary: aiResult.summary || '',
        aiDecisions: aiResult.decisions || '',
        aiActions: aiResult.actions || '',
        aiNextSteps: aiResult.nextSteps || '',
      });

      message.success('La IA mejoró y estructuró la minuta.');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Failed to improve meeting notes with AI:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos mejorar la minuta con IA.',
      );
    } finally {
      setIsImprovingMeetingNotes(false);
    }
  };

  const handleSaveMeetingNote = async () => {
    try {
      const values = await meetingNoteForm.validateFields();
      setIsSavingMeetingNote(true);
      const normalizedParticipants = Array.isArray(values.participants)
        ? (values.participants as unknown[])
            .map(item => String(item || '').trim())
            .filter(Boolean)
        : String(values.participants || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

      const existingParticipantNames = new Set(
        participantDirectoryMembers
          .map(member => member.fullName.trim().toLocaleLowerCase())
          .filter(Boolean),
      );

      const manualParticipants = [...new Set(normalizedParticipants)].filter(
        participant => !existingParticipantNames.has(participant.toLocaleLowerCase()),
      );

      if (manualParticipants.length > 0) {
        await Promise.all(
          manualParticipants.map(name =>
            createExternalParticipant({
              name,
              organizationDocumentId: activeMembership?.organization?.documentId,
              sourceProjectDocumentId: project.documentId,
            }),
          ),
        );
        await queryClient.invalidateQueries({ queryKey: ['participant-directory-members'] });
      }

      await saveMeetingNote({
        id: editingMeetingNote?.id || `note-${Date.now()}`,
        projectId: project.id,
        title: String(values.title || '').trim() || `Minuta del ${values.date}`,
        date: values.date,
        time: String(values.time || '').trim(),
        participants: normalizedParticipants.join(', '),
        notes: String(values.notes || '').trim(),
        aiSummary: String(values.aiSummary || '').trim() || undefined,
        aiDecisions: String(values.aiDecisions || '').trim() || undefined,
        aiActions: String(values.aiActions || '').trim() || undefined,
        aiNextSteps: String(values.aiNextSteps || '').trim() || undefined,
      });
      message.success(
        editingMeetingNote ? 'Minuta actualizada correctamente' : 'Minuta creada correctamente',
      );
      closeMeetingModal();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Failed to save meeting note:', error);
      message.error(error instanceof Error ? error.message : 'No pudimos guardar la minuta.');
    } finally {
      setIsSavingMeetingNote(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!validateInlineImageFile(file)) return false;

    try {
      const base64 = await readFileAsDataUrl(file);
      const nextLogo = base64 || undefined;
      const previousLogo = project.logo;

      setLogoPreview(nextLogo);

      const persisted = await persistProjectLogo(nextLogo);
      if (!persisted) {
        setLogoPreview(previousLogo);
        message.error('No pudimos guardar el avatar del proyecto.');
        return false;
      }

      message.success('Avatar del proyecto actualizado.');
    } catch (error) {
      console.error('Failed to read project logo:', error);
      message.error('No pudimos cargar la imagen.');
    }

    return false;
  };

  const handleSaveProject = async () => {
    try {
      const values = await projectForm.validateFields();
      const updatedProject: Project = {
        ...project,
        name: values.name.trim(),
        description: String(values.description || '').trim(),
        version: String(values.version || '').trim(),
        status: values.status,
        purpose: String(values.purpose || '').trim(),
        teamMembers: Array.isArray(values.teamMembers)
          ? values.teamMembers.map((member: string) => member.trim()).filter(Boolean)
          : [],
        coreRequirements: String(values.coreRequirements || '')
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean),
        businessRules: String(values.businessRules || '').trim(),
        logo: logoPreview,
        serviceBillingPhases: normalizeProjectServiceBillingPhases(values.serviceBillingPhases),
      };

      await saveProject(updatedProject);
      message.success('Información del proyecto actualizada');
      setIsEditModalOpen(false);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Failed to save project:', error);
      message.error('No pudimos guardar los cambios del proyecto.');
    }
  };

  const meetingHistoryColumns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (_: string, record: MeetingNote) => (
        <div>
          <Text strong className="text-slate-800">
            {highlightSearchMatch(record.title || `Minuta del ${record.date}`, meetingSearchTerm)}
          </Text>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarOutlined />
              {record.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockCircleOutlined />
              {record.time || 'Sin hora'}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Participantes',
      dataIndex: 'participants',
      key: 'participants',
      render: (value: string) => (
        <Text className="text-sm text-slate-600">{value?.trim() || 'Sin participantes'}</Text>
      ),
    },
    {
      title: 'Resumen',
      dataIndex: 'notes',
      key: 'notes',
      render: (value: string) => (
        <Paragraph className="!mb-0 text-sm text-slate-500" ellipsis={{ rows: 2 }}>
          {highlightSearchMatch(value?.trim() || 'Sin notas registradas.', meetingSearchTerm)}
        </Paragraph>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: MeetingNote) =>
        !isViewer ? (
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openMeetingModal(record)}
            className="text-slate-600"
          />
        ) : null,
    },
  ];

  return (
    <>
      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} xl={17}>
          <Card
            variant="borderless"
            className="overflow-hidden rounded-[30px] qa-surface-card"
            styles={{ body: { padding: 32 } }}
            style={{
              background: `linear-gradient(180deg, ${qaPalette.card} 0%, ${softSurface(qaPalette.accent)} 100%)`,
            }}
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-5">
                    <div className="relative shrink-0 group">
                      <Avatar
                        size={96}
                        shape="square"
                        src={logoPreview}
                        className="border border-slate-100 shadow-lg"
                        style={{
                          borderRadius: 26,
                          background: logoPreview
                            ? undefined
                            : `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.accent} 100%)`,
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 28,
                        }}
                      >
                        {!logoPreview ? getInitials(project.name) : null}
                      </Avatar>
                      {!isViewer ? (
                        <Upload
                          showUploadList={false}
                          beforeUpload={handleLogoUpload}
                          accept=".png,.jpg,.jpeg,.webp,.svg"
                          className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <div className="flex h-full w-full cursor-pointer items-center justify-center rounded-[26px] bg-slate-950/25 text-white">
                            <UploadOutlined className="text-xl" />
                          </div>
                        </Upload>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <Space size={[8, 8]} wrap>
                        <Tag
                          bordered={false}
                          className="rounded-full px-3 py-1 font-semibold"
                          style={{
                            color: qaPalette.primary,
                            backgroundColor: softSurface(qaPalette.primary),
                          }}
                        >
                          Project Overview
                        </Tag>
                        <Tag
                          bordered={false}
                          className="rounded-full px-3 py-1 font-semibold"
                          style={{
                            color: qaPalette.accent,
                            backgroundColor: softSurface(qaPalette.accent),
                          }}
                        >
                          Proyecto
                        </Tag>
                        <Tag
                          bordered={false}
                          className="rounded-full px-3 py-1 font-semibold"
                          style={{
                            color: statusMeta.color,
                            backgroundColor: softSurface(statusMeta.color),
                          }}
                        >
                          {statusMeta.label}
                        </Tag>
                      </Space>

                      <div>
                        <Title level={2} className="!mb-2 !text-slate-950">
                          {project.name}
                        </Title>
                        <Space size={16} wrap className="text-sm text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <ProfileOutlined />
                            {project.version || 'Sin versión registrada'}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <CalendarOutlined />
                            {stats.latestMeetingDate
                              ? `Última actualización ${dayjs(stats.latestMeetingDate).format('DD MMM YYYY')}`
                              : 'Sin minutas registradas'}
                          </span>
                        </Space>
                      </div>

                      <Paragraph className="!mb-0 max-w-3xl text-base leading-7 text-slate-500">
                        {project.description ||
                          'Gestiona el contexto del proyecto, su narrativa de negocio y las minutas clave del equipo QA en un solo espacio.'}
                      </Paragraph>
                    </div>
                  </div>

                  {!isViewer ? (
                    <div className="flex justify-end">
                      <IconActionButton
                        onClick={handleOpenEdit}
                        label="Editar proyecto"
                        title="Editar proyecto"
                      >
                        <IconBadge
                          accent={qaPalette.primary}
                          className="h-10 w-10 rounded-xl border-current bg-white text-current shadow-none"
                        >
                          <EditOutlined className="text-sm" />
                        </IconBadge>
                      </IconActionButton>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-stretch justify-center gap-3">
                  <MetricPill
                    label="Funcionalidades"
                    value={stats.functionalities}
                    accent={qaPalette.primary}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Casos"
                    value={stats.testCases}
                    accent={qaPalette.accent}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Bugs activos"
                    value={stats.activeBugs}
                    accent={qaPalette.functionalityStatus.failed}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Minutas"
                    value={stats.notes}
                    accent={qaPalette.functionalityStatus.inProgress}
                    className="w-full sm:w-[180px]"
                  />
                </div>
              </div>

              {isLoading ? (
                <Alert
                  type="info"
                  showIcon
                  className="rounded-2xl"
                  message="Cargando contexto del proyecto"
                  description="Estamos reuniendo funcionalidades, casos, bugs y minutas asociadas."
                />
              ) : null}

              <SurfaceCard
                title="Purpose and Vision"
                icon={<BulbOutlined className="text-2xl" />}
                accent={qaPalette.accent}
              >
                <Paragraph className="!mb-0 text-base leading-8 text-slate-600">
                  {project.purpose ||
                    'Define aquí el objetivo estratégico del proyecto y la visión que guía al equipo.'}
                </Paragraph>
              </SurfaceCard>

              {showServiceBillingSection ? (
              <SurfaceCard
                title="Servicios y Facturacion"
                icon={<ProfileOutlined className="text-2xl" />}
                accent={qaPalette.primary}
              >
                <div className="mb-6 flex flex-wrap gap-3">
                  <MetricPill
                    label="Fases"
                    value={serviceBillingSummary.phaseCount}
                    accent={qaPalette.primary}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Servicios"
                    value={serviceBillingSummary.serviceCount}
                    accent={qaPalette.accent}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Mensual"
                    value={formatCurrency(serviceBillingSummary.monthlyCost)}
                    accent={qaPalette.functionalityStatus.completed}
                    className="w-full sm:w-[180px]"
                  />
                  <MetricPill
                    label="Total"
                    value={formatCurrency(serviceBillingSummary.totalCost)}
                    accent={qaPalette.functionalityStatus.inProgress}
                    className="w-full sm:w-[180px]"
                  />
                </div>

                {serviceBillingPhases.length > 0 ? (
                  <div className="space-y-5">
                    {serviceBillingPhases.map(phase => {
                      const phaseMonthlyCost = phase.services.reduce(
                        (total, service) => total + (service.monthlyCost || 0),
                        0,
                      );
                      const phaseTotalCost = phase.services.reduce(
                        (total, service) => total + (service.totalCost || 0),
                        0,
                      );

                      return (
                        <Card
                          key={phase.id}
                          variant="borderless"
                          className="rounded-[24px] border border-slate-100 bg-white/90"
                          styles={{ body: { padding: 22 } }}
                        >
                          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <Title level={5} className="!mb-1 !text-slate-900">
                                {phase.phaseName || 'Fase sin nombre'}
                              </Title>
                              <Paragraph className="!mb-0 text-sm leading-6 text-slate-500">
                                {phase.description ||
                                  'Organiza aquÃ­ los servicios, procesos y cobros de esta fase.'}
                              </Paragraph>
                            </div>
                            <Space size={8} wrap>
                              <Tag color="blue">{phase.services.length} servicios</Tag>
                              <Tag color="green">Mensual {formatCurrency(phaseMonthlyCost)}</Tag>
                              <Tag color="gold">Total {formatCurrency(phaseTotalCost)}</Tag>
                            </Space>
                          </div>

                          <div className="space-y-3">
                            {phase.services.map(service => (
                              <div
                                key={service.id}
                                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <Text className="block text-base font-semibold text-slate-800">
                                      {service.serviceName || 'Servicio sin nombre'}
                                    </Text>
                                    <Text className="mt-1 block text-sm text-slate-500">
                                      {service.relatedProcesses.length > 0
                                        ? service.relatedProcesses.join(' | ')
                                        : 'Sin procesos relacionados definidos.'}
                                    </Text>
                                  </div>
                                  <Space size={8} wrap>
                                    <Tag bordered={false} color="cyan">
                                      {getBillingModeLabel(service.billingMode)}
                                    </Tag>
                                    <Tag bordered={false} color="green">
                                      Mensual {formatCurrency(service.monthlyCost)}
                                    </Tag>
                                    <Tag bordered={false} color="gold">
                                      Total {formatCurrency(service.totalCost)}
                                    </Tag>
                                  </Space>
                                </div>
                                {service.supportReport ? (
                                  <div className="mt-4 rounded-2xl border border-sky-100 bg-white px-4 py-3">
                                    <Text className="block text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                                      Informe de respaldo
                                    </Text>
                                    <Text className="mt-2 block text-sm font-semibold text-slate-800">
                                      {service.supportReport.title || 'Informe sin titulo'}
                                    </Text>
                                    <Text className="mt-1 block text-sm leading-6 text-slate-500">
                                      {service.supportReport.summary || 'Sin resumen del informe.'}
                                    </Text>
                                    {service.supportReport.referenceUrl ? (
                                      <a
                                        href={service.supportReport.referenceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex text-sm font-semibold text-sky-600 hover:text-sky-700"
                                      >
                                        Abrir referencia del informe
                                      </a>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Empty description="Aun no hay fases de servicios o facturacion configuradas para este proyecto." />
                )}
              </SurfaceCard>
              ) : null}

              <SurfaceCard
                title="Insights con IA y brief de wireframe"
                icon={<RobotOutlined className="text-2xl" />}
                accent="#6d28d9"
                extra={
                  !isViewer && canUseAi ? (
                    <Space size={12} wrap>
                      <HeaderActionButton
                        icon={<RobotOutlined />}
                        label={
                          project.aiProjectInsights ? 'Regenerar análisis' : 'Generar análisis'
                        }
                        accent="#7c3aed"
                        onClick={handleGenerateProjectAnalysis}
                        loading={activeAiAction === 'analysis'}
                        disabled={activeAiAction === 'brief'}
                      />
                      <HeaderActionButton
                        icon={<FileTextOutlined />}
                        label={project.aiWireframeBrief ? 'Regenerar brief' : 'Generar brief'}
                        accent={qaPalette.accent}
                        onClick={handleGenerateWireframeBrief}
                        loading={activeAiAction === 'brief'}
                        disabled={activeAiAction === 'analysis'}
                      />
                    </Space>
                  ) : null
                }
              >
                <div className="mb-6">
                  <Text className="text-slate-400">
                    Reutiliza el análisis del proyecto y el prompt listo para herramientas de
                    wireframing.
                  </Text>
                </div>

                {!isViewer && !canUseAi ? (
                  <div className="mb-6">
                    <AiUpgradeBanner
                      onViewPlans={() => setIsUpgradeModalOpen(true)}
                      onUpgradeGrowth={() => void handleUpgradeClick('about-view-ai-banner')}
                    />
                  </div>
                ) : null}

                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={12}>
                    <Card
                      variant="borderless"
                      className="h-full rounded-[24px] border border-slate-100 bg-white/90"
                      styles={{ body: { padding: 22 } }}
                    >
                      <div className="mb-4">
                        <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-600">
                          Análisis del proyecto
                        </Text>
                        <div className="mt-1 text-sm text-slate-400">
                          Riesgos, vacíos y recomendaciones accionables
                        </div>
                      </div>
                      {project.aiProjectInsights ? (
                        <div className="space-y-4">
                          <div className="max-h-[420px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                            <Paragraph className="!mb-0 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                              {project.aiProjectInsights}
                            </Paragraph>
                          </div>
                          <Button onClick={() => setOpenAiDetail('analysis')}>Ver detalle</Button>
                        </div>
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Aún no has generado el análisis del proyecto."
                        />
                      )}
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card
                      variant="borderless"
                      className="h-full rounded-[24px] border border-slate-100 bg-white/90"
                      styles={{ body: { padding: 22 } }}
                    >
                      <div className="mb-4">
                        <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-600">
                          Brief de wireframe
                        </Text>
                        <div className="mt-1 text-sm text-slate-400">
                          Texto listo para copiar en Stitch u otra herramienta
                        </div>
                      </div>
                      {project.aiWireframeBrief ? (
                        <div className="space-y-4">
                          <div className="max-h-[420px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                            <Paragraph className="!mb-0 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                              {project.aiWireframeBrief}
                            </Paragraph>
                          </div>
                          <Button onClick={() => setOpenAiDetail('brief')}>
                            Ver detalle completo
                          </Button>
                        </div>
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Aún no has generado el brief de wireframe."
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              </SurfaceCard>

              <Row gutter={[20, 20]}>
                <Col xs={24}>
                  <SurfaceCard
                    title="Participantes del proyecto"
                    icon={<TeamOutlined className="text-2xl" />}
                    accent={qaPalette.functionalityStatus.completed}
                  >
                    <Text className="mb-5 block text-slate-400">
                      {stats.participants} personas base asociadas al proyecto
                    </Text>
                    {project.teamMembers && project.teamMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {project.teamMembers.map(member => (
                          <Tag
                            key={member}
                            variant="filled"
                            className="m-0 rounded-full px-4 py-2 text-slate-700"
                            style={{ backgroundColor: softSurface(qaPalette.accent) }}
                          >
                            {member}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Empty description="No hay participantes base definidos para este proyecto." />
                    )}
                  </SurfaceCard>
                </Col>

                <Col xs={24} md={12}>
                  <SurfaceCard
                    title="Core Requirements"
                    icon={<CheckCircleOutlined className="text-2xl" />}
                    accent={qaPalette.primary}
                  >
                    {project.coreRequirements && project.coreRequirements.length > 0 ? (
                      <List
                        dataSource={project.coreRequirements}
                        renderItem={item => (
                          <List.Item className="!px-0">
                            <Text className="text-base leading-7 text-slate-700">{item}</Text>
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No hay requerimientos core definidos." />
                    )}
                  </SurfaceCard>
                </Col>

                <Col xs={24} md={12}>
                  <SurfaceCard
                    title="Business Rules"
                    icon={<FlagOutlined className="text-2xl" />}
                    accent={qaPalette.functionalityStatus.inProgress}
                  >
                    {businessRules.length > 0 ? (
                      <div className="space-y-4">
                        {businessRules.map((rule, index) => (
                          <div
                            key={`${rule}-${index}`}
                            className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                            style={{
                              borderLeft: `4px solid ${
                                index % 2 === 0 ? qaPalette.primary : qaPalette.accent
                              }`,
                            }}
                          >
                            <Text className="block text-base font-semibold text-slate-800">
                              {rule}
                            </Text>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty description="No hay reglas de negocio definidas." />
                    )}
                  </SurfaceCard>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            variant="borderless"
            className="h-full rounded-[30px] qa-surface-card"
            styles={{ body: { padding: 24 } }}
          >
            <div className="flex h-full flex-col gap-6">
              <SurfaceCard
                title="Minutas de Reunión"
                icon={<MessageOutlined className="text-2xl" />}
                accent={qaPalette.primary}
                stackHeader
                className="!rounded-[24px]"
                extraBelow={
                  <div className="flex items-center gap-2">
                    {sortedMeetingNotes.length > 1 ? (
                      <Button
                        type="text"
                        onClick={() => setIsMeetingHistoryOpen(true)}
                        className="rounded-2xl px-3 font-semibold text-slate-500 hover:!bg-slate-50 hover:!text-slate-700"
                      >
                        Ver más
                      </Button>
                    ) : null}
                    {!isViewer ? (
                      <IconActionButton
                        onClick={openMeetingModal}
                        label="Agregar minuta"
                        title="Agregar minuta"
                      >
                        <IconBadge
                          accent={qaPalette.primary}
                          className="h-10 w-10 rounded-xl border-current bg-white text-current shadow-none"
                        >
                          <PlusOutlined className="text-lg" />
                        </IconBadge>
                      </IconActionButton>
                    ) : null}
                  </div>
                }
              >
                <Text className="mb-5 block text-slate-400">
                  Seguimiento de conversaciones y acuerdos
                </Text>

                <Row gutter={[12, 12]} className="mb-4">
                  <Col span={12}>
                    <MetricPill label="Minutas" value={stats.notes} accent={qaPalette.primary} />
                  </Col>
                  <Col span={12}>
                    <MetricPill
                      label="Participantes"
                      value={stats.participants}
                      accent={qaPalette.accent}
                    />
                  </Col>
                </Row>

                {sortedMeetingNotes.length > 0 ? (
                  <div className="space-y-5">
                    {sortedMeetingNotes.slice(0, 1).map(note => (
                      <Card
                        key={note.id}
                        hoverable
                        variant="borderless"
                        className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,252,0.98)_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_20px_40px_rgba(15,23,42,0.1)]"
                        styles={{ body: { padding: 0 } }}
                      >
                        <div className="relative">
                          <div
                            className="h-1.5 w-full"
                            style={{
                              background: `linear-gradient(90deg, ${qaPalette.primary} 0%, ${qaPalette.accent} 100%)`,
                            }}
                          />

                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Tag
                                    bordered={false}
                                    className="m-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                                    style={{
                                      color: qaPalette.primary,
                                      backgroundColor: softSurface(qaPalette.primary),
                                    }}
                                  >
                                    General
                                  </Tag>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    <TeamOutlined className="text-[10px]" />
                                    {getMeetingParticipantCountLabel(note.participants)}
                                  </span>
                                </div>

                                <Title
                                  level={5}
                                  className="!mb-0 !block !w-full !text-[17px] !font-semibold !leading-6 !text-slate-900"
                                >
                                  {note.title || `Minuta del ${formatMeetingNoteDate(note.date)}`}
                                </Title>
                              </div>

                              {!isViewer ? (
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => openMeetingModal(note)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-slate-500 shadow-sm hover:!border-slate-300 hover:!bg-slate-50 hover:!text-slate-700"
                                />
                              ) : null}
                            </div>

                            <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                              <Text className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Fecha y hora
                              </Text>
                              <span className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                <ClockCircleOutlined className="text-slate-400" />
                                {formatMeetingNoteDate(note.date)}
                                <span className="text-slate-300">|</span>
                                {note.time || 'Sin hora'}
                              </span>
                            </div>

                            <Paragraph
                              className="!mb-0 rounded-[18px] border border-dashed border-slate-200 bg-white/75 px-3.5 py-3 text-sm leading-6 text-slate-600"
                              ellipsis={{ rows: 3, expandable: false }}
                            >
                              {getMeetingPreview(note.notes)}
                            </Paragraph>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : null}

                {sortedMeetingNotes.length === 0 ? (
                  <Empty description="No hay minutas registradas todavía." />
                ) : null}
              </SurfaceCard>

              <div
                className="mt-auto rounded-[28px] p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.primary} 100%)`,
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text className="!text-white">Project Progress</Text>
                  <Text className="!text-white/75">{stats.documentationScore}%</Text>
                </div>
                <Progress
                  percent={stats.documentationScore}
                  showInfo={false}
                  strokeColor={qaPalette.accent}
                  trailColor="rgba(255,255,255,0.16)"
                  size={{ height: 8 }}
                />
                <Text className="mt-4 block !text-white/80">
                  {stats.notes} minutas registradas, {stats.functionalities} funcionalidades y{' '}
                  {stats.testCases} casos documentados.
                </Text>
              </div>

              <Card
                variant="borderless"
                className="rounded-[28px] border border-slate-100 bg-white/90"
                styles={{ body: { padding: 22 } }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <WarningOutlined
                    className="text-xl"
                    style={{ color: qaPalette.functionalityStatus.failed }}
                  />
                  <Title level={5} className="!mb-0 !text-slate-900">
                    Salud QA rápida
                  </Title>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <Text className="text-slate-500">Bugs activos</Text>
                    <Text className="font-semibold text-slate-900">{stats.activeBugs}</Text>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <Text className="text-slate-500">Requisitos core</Text>
                    <Text className="font-semibold text-slate-900">
                      {project.coreRequirements?.length || 0}
                    </Text>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <Text className="text-slate-500">Reglas de negocio</Text>
                    <Text className="font-semibold text-slate-900">{businessRules.length}</Text>
                  </div>
                </div>
              </Card>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">Editar información del proyecto</span>
        }
        open={isEditModalOpen}
        onOk={!isViewer ? handleSaveProject : undefined}
        onCancel={handleCloseEdit}
        width={920}
        centered
        okText="Guardar cambios"
        cancelText="Cancelar"
        destroyOnHidden
        okButtonProps={{
          loading: isSaving || isSavingLogo,
          style: { display: isViewer ? 'none' : undefined },
        }}
      >
        <Form form={projectForm} layout="vertical" className="mt-4" disabled={isViewer}>
          <div className="mb-5 flex items-center gap-4 rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
            <Avatar
              size={72}
              shape="square"
              src={logoPreview}
              style={{
                borderRadius: 20,
                background: logoPreview
                  ? undefined
                  : `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.accent} 100%)`,
                color: '#fff',
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              {!logoPreview ? getInitials(project.name) : null}
            </Avatar>
            <div className="flex-1">
              <Text className="block text-sm font-semibold text-slate-700">
                Avatar del proyecto
              </Text>
              <Text className="block text-slate-400">
                Sube un logo en PNG, JPG, WEBP o SVG para personalizar esta vista.
              </Text>
            </div>
            {!isViewer ? (
              <Upload
                showUploadList={false}
                beforeUpload={handleLogoUpload}
                accept=".png,.jpg,.jpeg,.webp,.svg"
              >
                <Button icon={<UploadOutlined />} className="rounded-2xl" loading={isSavingLogo}>
                  Subir avatar
                </Button>
              </Upload>
            ) : null}
          </div>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Nombre del proyecto" rules={[{ required: true }]}>
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="description" label="Descripción general">
                <Input size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="version" label="Versión" rules={[{ required: true }]}>
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Estado del proyecto" rules={[{ required: true }]}>
                <Select
                  size="large"
                  options={[
                    { label: 'Activo', value: ProjectStatus.ACTIVE },
                    { label: 'Pausado', value: ProjectStatus.PAUSED },
                    { label: 'Completado', value: ProjectStatus.COMPLETED },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="purpose" label="Objetivo del proyecto">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item name="teamMembers" label="Participantes del proyecto">
            <ParticipantSelect
              size="large"
              members={participantDirectoryMembers}
              valueField="fullName"
              placeholder="Selecciona participantes base del proyecto"
              className="rounded-2xl"
              loading={isParticipantDirectoryLoading}
            />
          </Form.Item>

          <Form.Item name="coreRequirements" label="Requisitos básicos (uno por línea)">
            <Input.TextArea
              rows={5}
              placeholder="Ej: Autenticación biométrica&#10;Pasarela de pagos"
            />
          </Form.Item>

          <Form.Item name="businessRules" label="Normas empresariales">
            <Input.TextArea rows={5} />
          </Form.Item>

        </Form>
      </Modal>

      <UpgradeModal
        open={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        organizationName={activeOrganizationName}
        currentPlan={effectiveOrganizationPlan}
        title="Desbloquea IA para analizar y aterrizar el proyecto"
        description="Si quieres generar análisis del proyecto y briefs de wireframe directamente desde esta vista, aquí puedes comparar el siguiente paso con claridad."
        onUpgradeGrowth={() => void handleUpgradeClick('about-view-upgrade-modal-growth')}
        onContactEnterprise={() => void handleEnterpriseClick()}
      />

      <Modal
        title={<span className="text-lg font-bold text-slate-800">{activeAiDetailTitle}</span>}
        open={Boolean(openAiDetail)}
        onCancel={() => setOpenAiDetail(null)}
        width={1020}
        centered
        destroyOnHidden
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => void handleCopyAiDetail()}>
            Copiar
          </Button>,
          <Button key="close" type="primary" onClick={() => setOpenAiDetail(null)}>
            Cerrar
          </Button>,
        ]}
      >
        <div className="mt-4 space-y-5">
          <Alert
            type="info"
            showIcon
            className="rounded-2xl"
            message="Resultado reutilizable"
            description="Este contenido queda asociado al proyecto actual para que puedas reabrirlo y copiarlo cuando lo necesites."
          />

          <div className="max-h-[65vh] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-6">
            <Paragraph className="!mb-0 whitespace-pre-wrap text-base leading-8 text-slate-700">
              {activeAiDetailContent || 'No hay contenido disponible todavía.'}
            </Paragraph>
          </div>
        </div>
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Minutas registradas</span>}
        open={isMeetingHistoryOpen}
        onCancel={() => {
          setIsMeetingHistoryOpen(false);
          setMeetingSearchTerm('');
          setMeetingFilterDate(null);
        }}
        footer={null}
        width={920}
        centered
        destroyOnHidden
      >
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:flex-row md:items-center">
            <Input
              allowClear
              size="large"
              value={meetingSearchTerm}
              onChange={event => setMeetingSearchTerm(event.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Buscar por título o palabras dentro de la nota"
              className="rounded-2xl"
            />
            <DatePicker
              allowClear
              size="large"
              value={meetingFilterDate ? dayjs(meetingFilterDate) : null}
              onChange={value => setMeetingFilterDate(value ? value.format('YYYY-MM-DD') : null)}
              format="DD/MM/YYYY"
              placeholder="Filtrar por fecha"
              className="w-full rounded-2xl md:w-[220px]"
            />
            <Button
              size="large"
              onClick={() => {
                setMeetingSearchTerm('');
                setMeetingFilterDate(null);
              }}
              className="rounded-2xl px-4 font-semibold"
            >
              Limpiar
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <Text className="!text-slate-500">
              {filteredMeetingNotes.length} resultado
              {filteredMeetingNotes.length === 1 ? '' : 's'}
            </Text>
            {(meetingSearchTerm.trim() || meetingFilterDate) && (
              <Text className="!text-slate-400">Filtros aplicados</Text>
            )}
          </div>

          <Table
            rowKey="id"
            columns={meetingHistoryColumns}
            dataSource={filteredMeetingNotes}
            pagination={{
              pageSize: 6,
              showTotal: total => `${total} minuta${total === 1 ? '' : 's'}`,
            }}
            locale={{
              emptyText:
                meetingSearchTerm.trim() || meetingFilterDate
                  ? 'No encontramos minutas con esos filtros.'
                  : 'No hay minutas registradas todavía.',
            }}
            expandable={{
              columnWidth: 56,
              expandIcon: ({ expanded, onExpand, record }) => (
                <button
                  type="button"
                  aria-label={expanded ? 'Ocultar detalle de la minuta' : 'Ver detalle de la minuta'}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-sky-300 hover:text-sky-600"
                  onClick={event => onExpand(record, event)}
                >
                  {expanded ? (
                    <MinusOutlined className="text-[10px]" />
                  ) : (
                    <PlusOutlined className="text-[10px]" />
                  )}
                </button>
              ),
              expandedRowRender: record => (
                <div className="rounded-xl bg-slate-50 p-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <Text strong>Participantes:</Text>
                      <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {record.participants || 'Sin participantes registrados.'}
                      </Paragraph>
                    </div>
                    <div>
                      <Text strong>Fecha y hora:</Text>
                      <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                        {record.date} {record.time ? `a las ${record.time}` : ''}
                      </Paragraph>
                    </div>
                    <div className="md:col-span-2">
                      <Text strong>Notas:</Text>
                      <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {record.notes || 'Sin notas registradas.'}
                      </Paragraph>
                    </div>
                    {record.aiSummary ? (
                      <div className="md:col-span-2">
                        <Text strong>Resumen IA:</Text>
                        <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {record.aiSummary}
                        </Paragraph>
                      </div>
                    ) : null}
                    {record.aiDecisions ? (
                      <div>
                        <Text strong>Decisiones:</Text>
                        <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {record.aiDecisions}
                        </Paragraph>
                      </div>
                    ) : null}
                    {record.aiActions ? (
                      <div>
                        <Text strong>Acciones:</Text>
                        <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {record.aiActions}
                        </Paragraph>
                      </div>
                    ) : null}
                    {record.aiNextSteps ? (
                      <div className="md:col-span-2">
                        <Text strong>Pr??ximos pasos:</Text>
                        <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {record.aiNextSteps}
                        </Paragraph>
                      </div>
                    ) : null}
                    {!isViewer ? (
                      <div className="md:col-span-2">
                        <Button icon={<EditOutlined />} onClick={() => openMeetingModal(record)}>
                          Editar minuta
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            }}
          />
        </div>
      </Modal>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {editingMeetingNote ? 'Editar minuta de reunión' : 'Nueva minuta de reunión'}
          </span>
        }
        open={isMeetingModalOpen}
        onCancel={closeMeetingModal}
        onOk={handleSaveMeetingNote}
        width={640}
        centered
        okText={editingMeetingNote ? 'Actualizar minuta' : 'Guardar minuta'}
        cancelText="Cancelar"
        destroyOnHidden
        okButtonProps={{
          loading: isSavingMeetingNote,
          className: 'rounded-2xl px-5 font-semibold',
        }}
        cancelButtonProps={{ className: 'rounded-2xl px-5 font-semibold' }}
      >
        <Form form={meetingNoteForm} layout="vertical" className="mt-4">
          <Form.Item
            name="title"
            label="Título"
            rules={[{ required: true, message: 'Ingresa un título para la minuta.' }]}
          >
            <Input size="large" className="rounded-2xl" placeholder="Ej. Seguimiento sprint 12" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="date"
                label="Fecha"
                rules={[{ required: true, message: 'Selecciona una fecha.' }]}
              >
                <Input size="large" type="date" className="rounded-2xl" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="time" label="Hora">
                <Input size="large" type="time" className="rounded-2xl" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="participants"
            label="Participantes"
            extra="Puedes seleccionar miembros existentes o escribir un nombre externo y presionar Enter."
          >
            <ParticipantSelect
              className="rounded-2xl"
              size="large"
              members={participantDirectoryMembers}
              valueField="fullName"
              multiple
              allowCustomOptions
              extraOptions={meetingParticipantExtraOptions}
              loading={isParticipantDirectoryLoading}
              placeholder="Selecciona miembros del workspace o escribe un participante externo"
            />
          </Form.Item>

          {!isViewer && !canUseAi ? (
            <div className="mb-5">
              <AiUpgradeBanner
                title="✨ IA disponible en Growth — Escribe minutas más claras sin esfuerzo"
                description="Activa sugerencias automáticas para este flujo y convierte notas rápidas en minutas más claras y accionables."
                ctaLabel="Probar IA ✨"
                compact
                onViewPlans={() => setIsUpgradeModalOpen(true)}
                onUpgradeGrowth={() =>
                  void handleUpgradeClick('about-view-meeting-notes-ai-banner')
                }
              />
            </div>
          ) : null}

          <Form.Item
            name="notes"
            label={
              <div className="flex w-full items-center justify-between gap-3">
                <span>Notas</span>
                {!isViewer && canUseAi ? (
                  <Button
                    type="default"
                    icon={<RobotOutlined />}
                    onClick={() => void handleImproveMeetingNotes()}
                    loading={isImprovingMeetingNotes}
                    className="rounded-2xl border-slate-200 px-4 font-semibold text-violet-700"
                  >
                    Mejorar nota con IA
                  </Button>
                ) : null}
              </div>
            }
            rules={[{ required: true, message: 'Agrega el contenido principal de la minuta.' }]}
          >
            <Input.TextArea
              rows={6}
              className="rounded-2xl"
              placeholder="Acuerdos, decisiones, bloqueos y próximos pasos"
            />
          </Form.Item>

          <Form.Item name="aiSummary" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="aiDecisions" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="aiActions" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="aiNextSteps" hidden>
            <Input />
          </Form.Item>

          {canUseAi &&
          (meetingAiPreview.summary ||
            meetingAiPreview.decisions.length ||
            meetingAiPreview.actions.length ||
            meetingAiPreview.nextSteps.length) ? (
            <div className="rounded-[24px] border border-violet-100 bg-[linear-gradient(135deg,rgba(124,58,237,0.06)_0%,rgba(255,255,255,0.98)_100%)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge accent="#7c3aed" className="h-10 w-10 rounded-xl shadow-none">
                  <RobotOutlined className="text-base" />
                </IconBadge>
                <div>
                  <Text className="block text-[11px] font-bold uppercase tracking-[0.18em] text-violet-500">
                    Mejora IA
                  </Text>
                  <Title level={5} className="!mb-0 !mt-1 !text-slate-900">
                    Nota resumida por IA
                  </Title>
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
                <Text className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Vista previa IA
                </Text>
                <Paragraph className="!mb-0 !mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {meetingAiPreviewText}
                </Paragraph>
              </div>
            </div>
          ) : null}
        </Form>
      </Modal>
    </>
  );
}
