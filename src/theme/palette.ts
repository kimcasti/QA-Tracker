export const qaBrand = {
  name: 'QA Tracker',
  tagline: 'Quality Assurance Workspace',
  workspaceLabel: 'QA Workspace',
} as const;

export const qaPalette = {
  primary: '#123F68',
  primaryHover: '#0F3558',
  primaryActive: '#0B2945',
  accent: '#17B6D3',
  accentSoft: '#E8F8FC',
  secondary: '#5D748B',
  textMuted: '#6B7C93',
  background: '#F4F8FB',
  card: '#FFFFFF',
  border: '#D9E5EF',
  text: '#102A43',
  storyMapCard: '#F3FBFD',
  storyMapBorder: '#90D9E7',
  functionalityStatus: {
    backlog: '#8EA1B3',
    postMvp: '#1E6481',
    inProgress: '#F3A322',
    completed: '#149B8B',
    failed: '#E25A5F',
  },
  bugStatus: {
    pending: '#F3A322',
    inProgress: '#17B6D3',
    qa: '#1E6481',
    resolved: '#149B8B',
  },
} as const;

export const qaCssVariables = {
  '--qa-color-primary': qaPalette.primary,
  '--qa-color-primary-hover': qaPalette.primaryHover,
  '--qa-color-primary-active': qaPalette.primaryActive,
  '--qa-color-accent': qaPalette.accent,
  '--qa-color-accent-soft': qaPalette.accentSoft,
  '--qa-color-secondary': qaPalette.secondary,
  '--qa-color-text-muted': qaPalette.textMuted,
  '--qa-color-bg': qaPalette.background,
  '--qa-color-card': qaPalette.card,
  '--qa-color-border': qaPalette.border,
  '--qa-color-text': qaPalette.text,
  '--qa-color-story-card': qaPalette.storyMapCard,
  '--qa-color-story-border': qaPalette.storyMapBorder,
  '--qa-color-status-backlog': qaPalette.functionalityStatus.backlog,
  '--qa-color-status-post-mvp': qaPalette.functionalityStatus.postMvp,
  '--qa-color-status-in-progress': qaPalette.functionalityStatus.inProgress,
  '--qa-color-status-completed': qaPalette.functionalityStatus.completed,
  '--qa-color-status-failed': qaPalette.functionalityStatus.failed,
  '--qa-color-bug-pending': qaPalette.bugStatus.pending,
  '--qa-color-bug-in-progress': qaPalette.bugStatus.inProgress,
  '--qa-color-bug-qa': qaPalette.bugStatus.qa,
  '--qa-color-bug-resolved': qaPalette.bugStatus.resolved,
} as const;

export function applyQaCssVariables(target?: HTMLElement) {
  if (typeof document === 'undefined' && !target) return;
  const element = target ?? document.documentElement;
  Object.entries(qaCssVariables).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}

export function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export function softSurface(hex: string) {
  return withAlpha(hex, '12');
}

export function softBorder(hex: string) {
  return withAlpha(hex, '2E');
}
