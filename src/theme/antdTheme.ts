import type { ThemeConfig } from 'antd';
import { qaPalette, withAlpha } from './palette';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: qaPalette.primary,
    colorInfo: qaPalette.accent,
    colorSuccess: qaPalette.functionalityStatus.completed,
    colorWarning: qaPalette.functionalityStatus.inProgress,
    colorError: qaPalette.functionalityStatus.failed,
    colorText: qaPalette.text,
    colorTextSecondary: qaPalette.textMuted,
    colorBgLayout: qaPalette.background,
    colorBgContainer: qaPalette.card,
    colorBorder: qaPalette.border,
    colorSplit: qaPalette.border,
    colorFillAlter: qaPalette.accentSoft,
    colorLink: qaPalette.primary,
    colorLinkHover: qaPalette.primaryHover,
    colorPrimaryHover: qaPalette.primaryHover,
    colorPrimaryActive: qaPalette.primaryActive,
    controlOutline: withAlpha(qaPalette.accent, '2E'),
    borderRadius: 14,
    borderRadiusLG: 18,
    borderRadiusSM: 10,
    boxShadowSecondary: '0 18px 40px rgba(16, 42, 67, 0.10)',
    fontSize: 14,
    wireframe: false,
  },
};
