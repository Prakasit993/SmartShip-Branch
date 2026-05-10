/**
 * รูปแบบไฟล์ภาพที่รองรับการอัปโหลดแอดมิน (ตรงกับ /api/admin/upload)
 * — Web นิยม: JPEG, PNG, WebP, GIF, AVIF
 */

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** แมป MIME → นามสกุลที่เก็บใน Storage */
export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/jfif': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/** ค่า `accept` ของ `<input type="file">` ให้ตรงกับเซิร์ฟเวอร์ */
export const ADMIN_PRODUCT_IMAGE_ACCEPT = Object.keys(EXTENSION_BY_MIME).join(',');

export const ADMIN_PRODUCT_IMAGE_SHORT_LABEL_TH = 'JPEG / JPG, PNG, WebP, GIF และ AVIF';

export const ADMIN_PRODUCT_IMAGE_HELP_TH = `อัปโหลดได้เฉพาะภาพมาตรฐาน (${ADMIN_PRODUCT_IMAGE_SHORT_LABEL_TH}) ขนาดไม่เกิน 5 MB`;

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

/**
 * ระบุ MIME ที่ยอมรับได้ — รองรับกรณีเบราว์เซอร์/sdcard ไม่ใส่ file.type
 */
export function resolveProductImageMime(file: File): string | null {
  if (file.type && EXTENSION_BY_MIME[file.type]) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const mime = EXT_TO_MIME[ext];
  return mime && EXTENSION_BY_MIME[mime] ? mime : null;
}
