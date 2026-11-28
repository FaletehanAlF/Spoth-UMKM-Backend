/**
 * Deteksi tipe gambar dari isi file (magic bytes), bukan dari header
 * `Content-Type` yang dikirim client. Header tersebut mudah dipalsukan.
 */

export type DetectedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Mengembalikan MIME gambar yang terdeteksi, atau `null` bila isi file
 * bukan JPG/PNG/WEBP yang valid.
 */
export function detectImageMime(buffer: Buffer): DetectedImageMime | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  // WEBP: "RIFF" <size> "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Menyamakan `image/jpg` (varian lama) dengan `image/jpeg`.
 */
export function normalizeImageMime(mime: string): string {
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

/** Apakah MIME dari client cocok dengan isi file yang terdeteksi. */
export function isImageMimeCompatible(clientMime: string, detected: DetectedImageMime): boolean {
  return normalizeImageMime(clientMime) === detected;
}
