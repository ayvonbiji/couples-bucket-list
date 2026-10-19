// Image compression before upload: max 1600px on the long edge, ~0.5MB, JPEG/WebP.
import imageCompression from 'browser-image-compression';

const OPTIONS = { maxSizeMB: 0.5, maxWidthOrHeight: 1600, useWebWorker: true, initialQuality: 0.82 };

/** Compress one File; returns { blob, width, height }. Falls back to the original on failure. */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
  if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name} is larger than 40 MB`);
  let blob = file;
  try {
    // GIFs would lose animation; keep them as-is.
    if (file.type !== 'image/gif') blob = await imageCompression(file, OPTIONS);
  } catch (e) {
    console.warn('Compression failed, uploading original', e);
  }
  const { width, height } = await dimensions(blob);
  return { blob, width, height };
}

function dimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Blob → data URL (used by the PDF export). */
export const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
