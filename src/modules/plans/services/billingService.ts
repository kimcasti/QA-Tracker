import { Http, toApiError } from '../../../config/http';

type UpgradeRequestInput = {
  requestedPlan: 'growth' | 'enterprise';
  source: string;
  currentCount?: number | null;
  limitValue?: number | null;
  priceMonthlyUsd?: number | null;
  notes?: string | null;
};

function openUrl(url: string) {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');

  if (!popup) {
    window.location.href = url;
  }
}

function openPendingTab() {
  const popup = window.open('about:blank', '_blank');

  if (!popup) {
    return null;
  }

  try {
    popup.opener = null;
    popup.document.title = 'Abriendo WhatsApp...';
    popup.document.body.innerHTML =
      '<div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">Conectando con WhatsApp...</div>';
  } catch {
    // If the browser restricts document access here, we still keep the popup handle.
  }

  return popup;
}

export async function requestUpgrade(input: UpgradeRequestInput) {
  try {
    const response = await Http.post('/api/billing/upgrade-request', {
      data: {
        requestedPlan: input.requestedPlan,
        source: input.source,
        currentCount: input.currentCount ?? null,
        limitValue: input.limitValue ?? null,
        priceMonthlyUsd: input.priceMonthlyUsd ?? null,
        notes: input.notes ?? null,
      },
    });

    return response.data?.data;
  } catch (error) {
    throw new Error(toApiError(error).message);
  }
}

export async function startUpgradeRequestFlow(input: UpgradeRequestInput & { contactUrl: string }) {
  const pendingTab = openPendingTab();

  try {
    await requestUpgrade(input);

    if (pendingTab) {
      pendingTab.location.replace(input.contactUrl);
      return;
    }

    openUrl(input.contactUrl);
  } catch (error) {
    pendingTab?.close();
    throw error;
  }
}
