/**
 * Downscale and re-encode a photo before it leaves the phone.
 *
 * A raw phone photo is 4–8 MB. Sending that would be slow on restaurant wifi,
 * expensive to process, and no more legible: the model reads at most 1568px on
 * the long edge for a standard-resolution image, so anything beyond that is
 * bytes spent for nothing.
 */

const MAX_EDGE = 1568;
const QUALITY = 0.8;
const OUTPUT_TYPE = 'image/jpeg';

export interface PreparedImage {
  /** Base64 payload with no data-URI prefix, ready for the API. */
  base64: string;
  mediaType: 'image/jpeg';
  /** Size of the base64 payload, for the request cap. */
  bytes: number;
  /** Object URL for previewing. Caller must revoke it. */
  previewUrl: string;
}

export class ImagePrepError extends Error {
  constructor(
    message: string,
    readonly reason: 'decode' | 'encode',
  ) {
    super(message);
    this.name = 'ImagePrepError';
  }
}

/**
 * Read, downscale and JPEG-encode a file chosen from the camera or gallery.
 *
 * Uses `createImageBitmap` where available: it decodes off the main thread and,
 * crucially, honours the EXIF orientation flag, so a photo taken in portrait
 * doesn't arrive sideways. Falls back to an `<img>` element otherwise.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await decode(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImagePrepError('Canvas is unavailable', 'encode');

  // Thermal receipts are thin dark strokes on white; smoothing the downscale
  // keeps them legible instead of aliasing them into dashes.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  if ('close' in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, QUALITY),
  );
  if (!blob) throw new ImagePrepError('Could not encode the image', 'encode');

  const base64 = await blobToBase64(blob);

  return {
    base64,
    mediaType: OUTPUT_TYPE,
    bytes: base64.length,
    previewUrl: URL.createObjectURL(blob),
  };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options bag; fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImagePrepError('Could not read this image', 'decode'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the `data:image/jpeg;base64,` prefix — the API wants raw base64.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new ImagePrepError('Could not read this image', 'decode'));
    reader.readAsDataURL(blob);
  });
}
