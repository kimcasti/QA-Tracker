import axios from 'axios';
import { message } from 'antd';

export const MAX_INLINE_IMAGE_SIZE_MB = 4;
export const MAX_INLINE_IMAGE_SIZE_BYTES = MAX_INLINE_IMAGE_SIZE_MB * 1024 * 1024;

export function validateInlineImageFile(file: File) {
  if (file.size > MAX_INLINE_IMAGE_SIZE_BYTES) {
    message.error(
      `La imagen excede el tamano maximo permitido de ${MAX_INLINE_IMAGE_SIZE_MB} MB. Comprimela o usa una mas liviana antes de adjuntarla.`,
    );
    return false;
  }

  return true;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve((event.target?.result as string) || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function isPayloadTooLargeError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 413;
}

export function showPayloadTooLargeMessage() {
  message.error(
    `La evidencia supera el limite permitido por el servidor. Usa una imagen de hasta ${MAX_INLINE_IMAGE_SIZE_MB} MB.`,
  );
}
