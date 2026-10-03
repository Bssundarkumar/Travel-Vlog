// Web Mercator math plus a small raster tile cache, so the trip video can be
// drawn straight onto a <canvas> (which MediaRecorder can capture) instead of
// Leaflet's DOM tiles.

export const TILE_SIZE = 256;
export const MAX_TILE_ZOOM = 18;
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

export interface Camera {
  lat: number;
  lng: number;
  zoom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

const MAX_LAT = 85.05112878;

/** World pixel coordinates at the given (possibly fractional) zoom. */
export function project(lat: number, lng: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin(clamped * Math.PI / 180);
  const x = (lng + 180) / 360 * scale;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

/** Screen position of a lat/lng for a camera centered in the viewport. */
export function toScreen(
  lat: number,
  lng: number,
  camera: Camera,
  viewport: Viewport
): [number, number] {
  const [px, py] = project(lat, lng, camera.zoom);
  const [cx, cy] = project(camera.lat, camera.lng, camera.zoom);
  return [px - cx + viewport.width / 2, py - cy + viewport.height / 2];
}

/** Largest zoom at which all points fit inside the viewport minus padding. */
export function fitZoom(
  points: { lat: number; lng: number }[],
  viewport: Viewport,
  padding: number,
  maxZoom: number = 14
): number {
  if (points.length === 0) return 2;
  const projected = points.map(p => project(p.lat, p.lng, 0));
  const xs = projected.map(p => p[0]);
  const ys = projected.map(p => p[1]);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  const availW = Math.max(viewport.width - padding * 2, 1);
  const availH = Math.max(viewport.height - padding * 2, 1);
  const zx = dx > 0 ? Math.log2(availW / dx) : maxZoom;
  const zy = dy > 0 ? Math.log2(availH / dy) : maxZoom;
  return Math.max(1, Math.min(maxZoom, zx, zy));
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
}

/** Tiles needed to cover the viewport, plus where to draw them. */
export function visibleTiles(
  camera: Camera,
  viewport: Viewport
): { tile: TileRef; dx: number; dy: number; size: number }[] {
  const z = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(camera.zoom)));
  const scale = Math.pow(2, camera.zoom - z);
  const size = TILE_SIZE * scale;
  const [cx, cy] = project(camera.lat, camera.lng, z);
  const left = cx - viewport.width / 2 / scale;
  const top = cy - viewport.height / 2 / scale;
  const right = cx + viewport.width / 2 / scale;
  const bottom = cy + viewport.height / 2 / scale;
  const n = Math.pow(2, z);

  const out: { tile: TileRef; dx: number; dy: number; size: number }[] = [];
  for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor(bottom / TILE_SIZE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor(right / TILE_SIZE); tx++) {
      const wrappedX = ((tx % n) + n) % n;
      out.push({
        tile: { z, x: wrappedX, y: ty },
        dx: (tx * TILE_SIZE - left) * scale,
        dy: (ty * TILE_SIZE - top) * scale,
        size,
      });
    }
  }
  return out;
}

export function tileKey(t: TileRef): string {
  return `${t.z}/${t.x}/${t.y}`;
}

export function tileUrl(t: TileRef): string {
  const sub = 'abcd'[(t.x + t.y) % 4];
  return TILE_URL.replace('{s}', sub)
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y));
}

interface TileEntry {
  img: HTMLImageElement;
  state: 'loading' | 'loaded' | 'failed';
  promise: Promise<void>;
}

export class TileCache {
  private entries = new Map<string, TileEntry>();
  onTileLoaded: (() => void) | null = null;

  private load(t: TileRef): TileEntry {
    const key = tileKey(t);
    const existing = this.entries.get(key);
    if (existing) return existing;

    const img = new Image();
    // Tiles must be CORS-clean or the canvas becomes tainted and can't be recorded.
    img.crossOrigin = 'anonymous';
    const entry: TileEntry = { img, state: 'loading', promise: Promise.resolve() };
    entry.promise = new Promise<void>(resolve => {
      img.onload = () => {
        entry.state = 'loaded';
        this.onTileLoaded?.();
        resolve();
      };
      img.onerror = () => {
        entry.state = 'failed';
        resolve();
      };
    });
    img.src = tileUrl(t);
    this.entries.set(key, entry);
    return entry;
  }

  /** Returns the image if ready; otherwise starts loading it and returns null. */
  get(t: TileRef): HTMLImageElement | null {
    const entry = this.load(t);
    return entry.state === 'loaded' ? entry.img : null;
  }

  /** Loads every tile, a few at a time, reporting progress. */
  async preload(tiles: TileRef[], onProgress?: (done: number, total: number) => void): Promise<void> {
    const unique = [...new Map(tiles.map(t => [tileKey(t), t])).values()];
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < unique.length) {
        const t = unique[next++];
        await this.load(t).promise;
        done++;
        onProgress?.(done, unique.length);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
  }
}

/** Draws the base map. Missing tiles fall back to a scaled-up parent tile. */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  cache: TileCache,
  camera: Camera,
  viewport: Viewport
): void {
  for (const { tile, dx, dy, size } of visibleTiles(camera, viewport)) {
    const img = cache.get(tile);
    if (img) {
      ctx.drawImage(img, dx, dy, size + 0.5, size + 0.5);
      continue;
    }
    if (tile.z === 0) continue;
    const parent = { z: tile.z - 1, x: Math.floor(tile.x / 2), y: Math.floor(tile.y / 2) };
    const parentImg = cache.get(parent);
    if (parentImg) {
      const half = TILE_SIZE / 2;
      ctx.drawImage(
        parentImg,
        (tile.x % 2) * half, (tile.y % 2) * half, half, half,
        dx, dy, size + 0.5, size + 0.5
      );
    }
  }
}
