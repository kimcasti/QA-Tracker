import { FloatButton, Tooltip } from 'antd';

function normalizeWhatsAppPhone(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

function getWhatsAppSupportUrl() {
  const phone = normalizeWhatsAppPhone(import.meta.env.VITE_UPGRADE_WHATSAPP_PHONE);
  const message = encodeURIComponent(
    'Hola, tengo una consulta sobre QA Tracker y necesito ayuda por WhatsApp.',
  );

  if (phone) {
    return `https://wa.me/${phone}?text=${message}`;
  }

  return `https://api.whatsapp.com/send?text=${message}`;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M19.11 17.23c-.27-.14-1.58-.78-1.83-.87-.24-.09-.42-.14-.6.14-.18.27-.69.87-.85 1.05-.16.18-.31.2-.58.07-.27-.14-1.12-.41-2.13-1.3-.79-.71-1.33-1.58-1.49-1.85-.16-.27-.02-.42.12-.55.12-.12.27-.31.41-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.14-.6-1.45-.82-1.98-.22-.53-.44-.45-.6-.46h-.51c-.18 0-.47.07-.71.34-.24.27-.93.91-.93 2.22s.96 2.58 1.09 2.76c.14.18 1.89 2.88 4.57 4.04.64.27 1.13.44 1.52.56.64.2 1.22.17 1.68.1.51-.08 1.58-.64 1.8-1.27.22-.63.22-1.16.15-1.27-.06-.1-.24-.17-.51-.31Z" />
      <path d="M16.02 3.2c-7.08 0-12.8 5.72-12.8 12.78 0 2.26.59 4.47 1.71 6.42L3 29l6.78-1.78a12.77 12.77 0 0 0 6.24 1.6h.01c7.07 0 12.8-5.72 12.8-12.79 0-3.42-1.33-6.64-3.76-9.06A12.72 12.72 0 0 0 16.02 3.2Zm0 23.46h-.01a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-4.02 1.05 1.08-3.92-.25-.4a10.63 10.63 0 0 1-1.64-5.65c0-5.89 4.8-10.69 10.7-10.69 2.86 0 5.54 1.11 7.56 3.13a10.62 10.62 0 0 1 3.13 7.56c0 5.9-4.8 10.7-10.7 10.7Z" />
    </svg>
  );
}

export function WhatsAppSupportButton() {
  return (
    <Tooltip title="Consultar por WhatsApp" placement="left">
      <FloatButton
        onClick={() => {
          window.open(getWhatsAppSupportUrl(), '_blank', 'noopener,noreferrer');
        }}
        icon={<WhatsAppIcon />}
        style={{
          insetInlineEnd: 24,
          bottom: 24,
          backgroundColor: '#16a34a',
          color: '#ffffff',
          boxShadow: '0 18px 34px rgba(22, 163, 74, 0.28)',
        }}
      />
    </Tooltip>
  );
}
