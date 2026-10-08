import React from 'react';
import { Button, Tooltip, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { AutomationStatus, deriveAutomationStatus, type TestCase, type Functionality } from '../../../types';
import { getAutomationImportHistories } from '../../automation-import-history/services/automationImportHistoryService';
import { downloadAutomationReferences } from '../utils/exportAutomationReferences';

export function ExportAutomationReferencesButton({ projectId, cases, functionalities, scopeName, disabled = false }: {
  projectId?: string;
  cases: TestCase[];
  functionalities: Pick<Functionality, 'id' | 'name' | 'module'>[];
  scopeName: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const hasCases = cases.some(item => item.projectId === projectId && deriveAutomationStatus(item) === AutomationStatus.AUTOMATED);
  const download = async () => {
    if (!projectId || loading || disabled || !hasCases) return;
    setLoading(true);
    try {
      const history = await getAutomationImportHistories(projectId);
      await downloadAutomationReferences(projectId, cases, functionalities, history, scopeName);
      message.success('Referencias automatizadas descargadas.');
    } catch {
      message.error('No fue posible descargar las referencias. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Tooltip title="Descarga de referencias de casos automatizados">
      <Button
        icon={<DownloadOutlined />}
        aria-label="Descarga de referencias de casos automatizados"
        loading={loading}
        disabled={disabled || !projectId || !hasCases}
        onClick={() => void download()}
      />
    </Tooltip>
  );
}
