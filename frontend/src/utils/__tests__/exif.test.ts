import { describe, expect, it } from 'vitest';
import { readPhotoMetadata } from '../exif';

/** Builds a JPEG header with an EXIF segment holding GPS and DateTimeOriginal. */
function makeJpeg(opts: { lat: number; lng: number; date: string; little: boolean }): ArrayBuffer {
  const tiff: number[] = [];
  const le = opts.little;
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => {
    const b = [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    return le ? b.reverse() : b;
  };
  const entry = (tag: number, type: number, count: number, value: number[]) =>
    [...u16(tag), ...u16(type), ...u32(count), ...value, 0, 0, 0, 0].slice(0, 12);

  // Layout: header(8) | IFD0 (2 entries) @8 | ExifIFD @38 | GPS IFD @56 | data @110
  const ifd0At = 8;
  const exifAt = ifd0At + 2 + 2 * 12 + 4;
  const gpsAt = exifAt + 2 + 12 + 4;
  const dataAt = gpsAt + 2 + 4 * 12 + 4;
  const dateAt = dataAt;
  const latAt = dateAt + 20;
  const lngAt = latAt + 24;

  const dms = (deg: number) => {
    const a = Math.abs(deg);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 100);
    return [...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(s), ...u32(100)];
  };

  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  tiff.push(...u16(2), ...entry(0x8769, 4, 1, u32(exifAt)), ...entry(0x8825, 4, 1, u32(gpsAt)), ...u32(0));
  tiff.push(...u16(1), ...entry(0x9003, 2, 20, u32(dateAt)), ...u32(0));
  tiff.push(
    ...u16(4),
    ...entry(1, 2, 2, [opts.lat < 0 ? 83 : 78, 0]),
    ...entry(2, 5, 3, u32(latAt)),
    ...entry(3, 2, 2, [opts.lng < 0 ? 87 : 69, 0]),
    ...entry(4, 5, 3, u32(lngAt)),
    ...u32(0)
  );
  tiff.push(...[...opts.date].map(c => c.charCodeAt(0)), 0);
  tiff.push(...dms(opts.lat), ...dms(opts.lng));

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

describe('readPhotoMetadata', () => {
  it.each([true, false])('reads GPS and capture time (little endian: %s)', little => {
    const meta = readPhotoMetadata(makeJpeg({ lat: 36.3715, lng: -121.9017, date: '2026:07:04 15:30:00', little }));
    expect(meta.lat).toBeCloseTo(36.3715, 3);
    expect(meta.lng).toBeCloseTo(-121.9017, 3);
    expect(meta.takenAt).toEqual(new Date(2026, 6, 4, 15, 30, 0));
  });

  it('handles the southern and eastern hemispheres', () => {
    const meta = readPhotoMetadata(makeJpeg({ lat: -33.8568, lng: 151.2153, date: '2025:01:01 00:00:00', little: true }));
    expect(meta.lat).toBeCloseTo(-33.8568, 3);
    expect(meta.lng).toBeCloseTo(151.2153, 3);
  });

  it('returns nulls for non-JPEG or EXIF-less input', () => {
    expect(readPhotoMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toEqual({ lat: null, lng: null, takenAt: null });
    expect(readPhotoMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toEqual({ lat: null, lng: null, takenAt: null });
  });

  it('survives a truncated EXIF segment', () => {
    const full = new Uint8Array(makeJpeg({ lat: 1, lng: 2, date: '2025:01:01 00:00:00', little: true }));
    expect(readPhotoMetadata(full.slice(0, 40).buffer).lat).toBeNull();
  });
});
