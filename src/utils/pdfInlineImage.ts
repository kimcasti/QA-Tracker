/** Browser-only remote image loading. No backend proxy or URL logging. */
const MAX_SOURCE_LENGTH = 16 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

export function validatePdfImageSource(value: string): string {
  const source = String(value || '').trim();
  if (!source || source.length > MAX_SOURCE_LENGTH) throw new Error('PDF_IMAGE_INVALID_SOURCE');
  if (/^data:image\/(?:png|jpeg);base64,[a-z\d+/]+={0,2}$/i.test(source)) return source;
  let url: URL;
  try { url = new URL(source); } catch { throw new Error('PDF_IMAGE_UNSUPPORTED_SOURCE'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('PDF_IMAGE_UNSUPPORTED_SOURCE');
  }
  return url.href;
}

export function validatePdfImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('PDF_IMAGE_INVALID_DIMENSIONS');
  }
}

export async function loadPdfInlineImage(value: string): Promise<string> {
  const source = validatePdfImageSource(value);
  // jsPDF decodes these directly, preserving PNG alpha and JPEG data without a
  // lossy canvas roundtrip. Its decoder also validates corrupt image bytes.
  if (source.startsWith('data:')) return source;
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    const finish = (error?: Error, data?: string) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) { image.src = ''; reject(error); }
      else resolve(data!);
    };
    const timer = setTimeout(() => finish(new Error('PDF_IMAGE_LOAD_TIMEOUT')), 10_000);
    image.onerror = () => finish(new Error('PDF_IMAGE_LOAD_FAILED'));
    image.onload = () => {
      try {
        validatePdfImageDimensions(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF_IMAGE_CONTEXT_MISSING');
        context.drawImage(image, 0, 0);
        const data = canvas.toDataURL('image/png');
        if (!data.startsWith('data:image/png;base64,')) throw new Error('PDF_IMAGE_ENCODING_FAILED');
        finish(undefined, data);
      } catch { finish(new Error('PDF_IMAGE_DECODE_OR_CORS_FAILED')); }
    };
    image.src = source;
  });
}
