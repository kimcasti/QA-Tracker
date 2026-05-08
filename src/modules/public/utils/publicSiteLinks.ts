export const publicLegalLinks = [
  { label: 'T\u00e9rminos', href: '/terminos' },
  { label: 'Privacidad', href: '/privacidad' },
  { label: 'Uso de IA', href: '/uso-ia' },
] as const;

function normalizeWhatsAppPhone(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

export function getPublicContactUrl() {
  const phone = normalizeWhatsAppPhone(import.meta.env.VITE_UPGRADE_WHATSAPP_PHONE);
  const message = encodeURIComponent(
    'Hola, tengo una consulta sobre QA Tracker y necesito ayuda.',
  );

  if (phone) {
    return `https://wa.me/${phone}?text=${message}`;
  }

  return `https://api.whatsapp.com/send?text=${message}`;
}
