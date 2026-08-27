// System support configuration fetched from backend
let cachedSupportConfig = {
  phone: '41 996679075',
  formattedPhone: '(41) 99667-9075',
  whatsappNumber: '5541996679075',
  defaultMessage: 'Olá! Gostaria de falar com o suporte do Express Tools.',
};

// Asynchronously load backend config
fetch('/api/config')
  .then(res => res.json())
  .then(data => {
    if (data?.support) {
      cachedSupportConfig = { ...cachedSupportConfig, ...data.support };
    }
  })
  .catch(() => {});

export const SUPPORT_PHONE = '41 996679075';
export const SUPPORT_PHONE_FORMATTED = '(41) 99667-9075';
export const SUPPORT_WHATSAPP_NUMBER = '5541996679075';

export function getWhatsAppSupportUrl(message?: string): string {
  const msg = message || cachedSupportConfig.defaultMessage;
  const num = cachedSupportConfig.whatsappNumber || SUPPORT_WHATSAPP_NUMBER;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function openWhatsAppSupport(message?: string): void {
  const url = getWhatsAppSupportUrl(message);
  window.open(url, '_blank', 'noopener,noreferrer');
}

