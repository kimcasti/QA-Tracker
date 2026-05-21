import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TestResult } from '../../../types';
import { normalizeEvidenceHtml, stripHtmlToText } from '../../../utils/evidenceRichText';
import {
  usePublicUatResultActions,
  usePublicUatSession,
} from '../hooks/usePublicUatSession';
import { derivePublicUatEvidencePayload } from '../services/publicUatSessionsService';

const { Title, Text, Paragraph } = Typography;
const EvidenceRichEditor = lazy(() => import('../../../components/EvidenceRichEditor'));

type ResultDraft = {
  result: TestResult;
  notes: string;
};

function extractTokenFromPathname(pathname: string) {
  const match = pathname.match(/^\/uat\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function renderRichText(value?: string | null) {
  const normalized = normalizeEvidenceHtml(value);
  const plainText = stripHtmlToText(value);

  if (!normalized || !plainText) {
    return <span className="text-sm text-slate-400">Sin contenido adicional.</span>;
  }

  return <div className="qa-rich-text-content text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: normalized }} />;
}

function resultOptions() {
  return Object.values(TestResult).map(value => ({
    label: value,
    value,
  }));
}

function formatPublicDate(value?: string | null, fallback = 'No disponible') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function PublicUatSessionPage() {
  const location = useLocation();
  const token = useMemo(() => extractTokenFromPathname(location.pathname), [location.pathname]);
  const { data, isLoading, error, refetch, isFetching } = usePublicUatSession(token);
  const { saveResult, completeSession, isSavingResult, isCompletingSession } =
    usePublicUatResultActions(token);
  const [drafts, setDrafts] = useState<Record<string, ResultDraft>>({});

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      (data?.testRun?.results || []).map(result => [
        result.id,
        {
          result: result.result,
          notes: result.notes || '',
        },
      ]),
    );

    setDrafts(nextDrafts);
  }, [data]);

  const executedCount = useMemo(() => {
    return (data?.testRun?.results || []).filter(result => result.result !== TestResult.NOT_EXECUTED)
      .length;
  }, [data]);

  const totalCount = data?.testRun?.results.length || 0;
  const isReadOnly = data?.session.readOnly ?? true;

  const saveSingleResult = async (resultId: string) => {
    const draft = drafts[resultId];
    if (!draft) return;

    try {
      const payload = derivePublicUatEvidencePayload(draft.notes);
      await saveResult({
        resultDocumentId: resultId,
        input: {
          result: draft.result,
          notes: payload.notes,
          evidenceImage: payload.evidenceImage,
        },
      });
      message.success('Resultado actualizado.');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar el resultado.');
    }
  };

  const handleComplete = async () => {
    try {
      await completeSession();
      message.success('La evaluación UAT fue finalizada correctamente.');
    } catch (completeError) {
      message.error(
        completeError instanceof Error
          ? completeError.message
          : 'No fue posible finalizar la evaluación UAT.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spin size="large" />
          <Text type="secondary">Cargando evaluación UAT...</Text>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <Card className="w-full max-w-2xl rounded-3xl border-slate-100 shadow-sm">
          <Alert
            type="error"
            showIcon
            message="No pudimos abrir esta evaluación UAT"
            description={
              <div className="space-y-3">
                <p>
                  El enlace puede haber expirado, haber sido cerrado o no ser válido.
                </p>
                <Button onClick={() => void refetch()} loading={isFetching}>
                  Reintentar
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Tag color="blue" className="rounded-full px-3 py-1 font-semibold">
                UAT pública
              </Tag>
              <Title level={2} className="!mb-0 !text-slate-800">
                {data.testRun?.title}
              </Title>
              <Paragraph className="!mb-0 text-slate-500">
                {data.testRun?.description || 'Validación externa compartida con cliente.'}
              </Paragraph>
              <Space size={[8, 8]} wrap className="mb-2">
                <Tag>{data.session.status}</Tag>
                {data.testRun?.executionDate ? (
                  <Tag>{formatPublicDate(data.testRun.executionDate)}</Tag>
                ) : null}
                {data.testRun?.sprint ? <Tag>{data.testRun.sprint}</Tag> : null}
                {data.testRun?.buildVersion ? <Tag>Build {data.testRun.buildVersion}</Tag> : null}
              </Space>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Participante:</span>{' '}
                {data.session.participantName}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Progreso:</span> {executedCount}/
                {totalCount}
              </div>
              {data.session.expiresAt ? (
                <div>
                  <span className="font-semibold text-slate-800">Expira:</span>{' '}
                  {formatPublicDate(data.session.expiresAt)}
                </div>
              ) : null}
            </div>
          </div>

          {data.session.deliveryNotes ? (
            <Alert
              className="mt-9 rounded-2xl"
              type="info"
              showIcon
              message="Indicaciones para la evaluación"
              description={data.session.deliveryNotes}
            />
          ) : null}
        </Card>

        {!data.testRun?.results.length ? (
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <Empty description="Esta evaluación UAT no tiene casos disponibles." />
          </Card>
        ) : null}

        {(data.testRun?.results || []).map(result => {
          const draft = drafts[result.id] || {
            result: result.result,
            notes: result.notes || '',
          };

          return (
            <Card key={result.id} className="rounded-3xl border-slate-100 shadow-sm">
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      {result.moduleName || 'Módulo'}
                    </Text>
                    <Title level={4} className="!mb-0 !text-slate-800">
                      {result.testCaseTitle || 'Caso de prueba'}
                    </Title>
                    <Text className="text-sm text-slate-500">
                      {result.functionalityName || 'Funcionalidad no disponible'}
                    </Text>
                  </div>
                  <div className="w-full max-w-xs">
                    <Text className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
                      Resultado
                    </Text>
                    <select
                      value={draft.result}
                      disabled={isReadOnly || !data.session.allowResultEditing}
                      onChange={event =>
                        setDrafts(current => ({
                          ...current,
                          [result.id]: {
                            ...draft,
                            result: event.target.value as TestResult,
                          },
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                    >
                      {resultOptions().map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <Text strong className="block text-slate-800">
                      Descripción
                    </Text>
                    <div className="mt-2">{renderRichText(result.testCaseDescription)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <Text strong className="block text-slate-800">
                      Precondiciones
                    </Text>
                    <div className="mt-2">{renderRichText(result.preconditions)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <Text strong className="block text-slate-800">
                      Resultado esperado
                    </Text>
                    <div className="mt-2">{renderRichText(result.expectedResult)}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <Text strong className="block text-slate-800">
                    Pasos de prueba
                  </Text>
                  <div className="mt-2">{renderRichText(result.testSteps)}</div>
                </div>

                <div className="space-y-2">
                  <Text className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Comentarios y evidencia
                  </Text>
                  <Suspense
                    fallback={<div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Cargando editor...</div>}
                  >
                    <EvidenceRichEditor
                      value={draft.notes}
                      onChange={value =>
                        setDrafts(current => ({
                          ...current,
                          [result.id]: {
                            ...draft,
                            notes: value,
                          },
                        }))
                      }
                      disabled={isReadOnly || (!data.session.allowCommentEditing && !data.session.allowEvidenceUpload)}
                      placeholder="Escribe aquí tus observaciones y, si aplica, pega o sube una evidencia."
                    />
                  </Suspense>
                </div>

                {!isReadOnly ? (
                  <div className="flex justify-end">
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={isSavingResult}
                      onClick={() => void saveSingleResult(result.id)}
                      className="rounded-xl"
                    >
                      Guardar resultado
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}

        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title level={4} className="!mb-1 !text-slate-800">
                Cierre de evaluación
              </Title>
              <Text className="text-slate-500">
                Cuando hayas terminado de registrar los resultados, finaliza esta sesión para dejarla cerrada.
              </Text>
            </div>

            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={isReadOnly}
              loading={isCompletingSession}
              onClick={() => void handleComplete()}
              className="h-11 rounded-xl px-6"
            >
              Finalizar evaluación UAT
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
