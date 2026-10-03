// Minimal JPEG EXIF reader: just the GPS position and capture time, which is
// all the trip video needs to place and order photos.

export interface PhotoMetadata {
  lat: number | null;
  lng: number | null;
  takenAt: Date | null;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const GPS_LAT_REF = 1;
const GPS_LAT = 2;
const GPS_LNG_REF = 3;
const GPS_LNG = 4;

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface IfdEntry {
  type: number;
  count: number;
  valueOffset: number; // absolute offset of the value bytes in the view
}

function readIfd(view: DataView, tiff: number, offset: number, little: boolean): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  const start = tiff + offset;
  if (start + 2 > view.byteLength) return entries;
  const count = view.getUint16(start, little);
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    const tag = view.getUint16(at, little);
    const type = view.getUint16(at + 2, little);
    const n = view.getUint32(at + 4, little);
    const size = (TYPE_SIZES[type] ?? 1) * n;
    const valueOffset = size <= 4 ? at + 8 : tiff + view.getUint32(at + 8, little);
    entries.set(tag, { type, count: n, valueOffset });
  }
  return entries;
}

function readAscii(view: DataView, e: IfdEntry | undefined): string | null {
  if (!e || e.valueOffset + e.count > view.byteLength) return null;
  let s = '';
  for (let i = 0; i < e.count; i++) {
    const c = view.getUint8(e.valueOffset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readDegrees(view: DataView, e: IfdEntry | undefined, little: boolean): number | null {
  if (!e || e.type !== 5 || e.count < 3 || e.valueOffset + 24 > view.byteLength) return null;
  const parts = [0, 1, 2].map(i => {
    const num = view.getUint32(e.valueOffset + i * 8, little);
    const den = view.getUint32(e.valueOffset + i * 8 + 4, little);
    return den === 0 ? 0 : num / den;
  });
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}

function parseExifDate(s: string | null): Date | null {
  const m = s?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, se);
}

function parseTiff(view: DataView, tiff: number): PhotoMetadata {
  const result: PhotoMetadata = { lat: null, lng: null, takenAt: null };
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return result;
  const little = order === 0x4949;
  const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little);

  const gpsPtr = ifd0.get(TAG_GPS_IFD);
  if (gpsPtr) {
    const gps = readIfd(view, tiff, view.getUint32(gpsPtr.valueOffset, little), little);
    const lat = readDegrees(view, gps.get(GPS_LAT), little);
    const lng = readDegrees(view, gps.get(GPS_LNG), little);
    if (lat !== null && lng !== null) {
      result.lat = readAscii(view, gps.get(GPS_LAT_REF)) === 'S' ? -lat : lat;
      result.lng = readAscii(view, gps.get(GPS_LNG_REF)) === 'W' ? -lng : lng;
    }
  }

  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  if (exifPtr) {
    const exif = readIfd(view, tiff, view.getUint32(exifPtr.valueOffset, little), little);
    result.takenAt = parseExifDate(readAscii(view, exif.get(TAG_DATETIME_ORIGINAL)));
  }
  result.takenAt ??= parseExifDate(readAscii(view, ifd0.get(TAG_DATETIME)));
  return result;
}

/** Reads GPS and capture time from JPEG bytes. Non-JPEG input yields nulls. */
export function readPhotoMetadata(buffer: ArrayBuffer): PhotoMetadata {
  const empty: PhotoMetadata = { lat: null, lng: null, takenAt: null };
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return empty;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) return empty; // image data reached
    const length = view.getUint16(offset + 2);
    const isExif = marker === 0xe1 && offset + 10 <= view.byteLength &&
      view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0; // "Exif\0\0"
    if (isExif) {
      try {
        return parseTiff(view, offset + 10);
      } catch {
        return empty; // truncated or malformed EXIF
      }
    }
    offset += 2 + length;
  }
  return empty;
}

/** EXIF lives in the first segment, so reading the head of the file is enough. */
export async function readFileMetadata(file: Blob): Promise<PhotoMetadata> {
  return readPhotoMetadata(await file.slice(0, 256 * 1024).arrayBuffer());
}
