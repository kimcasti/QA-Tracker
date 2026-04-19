function getEnvValue(value: unknown) {
  return String(value || '').trim();
}

export const getCloudinaryCloudName = () =>
  getEnvValue(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME) ||
  getEnvValue(process.env.CLOUDINARY_CLOUD_NAME);

export const getCloudinaryUploadPreset = () =>
  getEnvValue(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET) ||
  getEnvValue(process.env.CLOUDINARY_UPLOAD_PRESET);

export const hasCloudinaryConfigured = () =>
  Boolean(getCloudinaryCloudName() && getCloudinaryUploadPreset());

export async function uploadImageToCloudinary(file: File) {
  const cloudName = getCloudinaryCloudName();
  const uploadPreset = getCloudinaryUploadPreset();

  if (!cloudName || !uploadPreset) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'qa-tracker/evidence');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok || !payload?.secure_url) {
    throw new Error(payload?.error?.message || 'CLOUDINARY_UPLOAD_FAILED');
  }

  return {
    url: String(payload.secure_url),
    publicId: String(payload.public_id || ''),
  };
}
