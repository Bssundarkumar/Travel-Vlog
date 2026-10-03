// A built-in trip so the video can be tried without uploading photos. The
// "photos" are generated placeholder images.

import type { City, TripStop } from '../types/travel';
import { POPULAR_CITIES, getDistance } from './cities';

export const SAMPLE_TRIP: City[] = [
  { name: 'Golden Gate Bridge', lat: 37.8199, lng: -122.4783 },
  { name: 'Monterey Bay Aquarium', lat: 36.6182, lng: -121.9019 },
  { name: 'Bixby Creek Bridge, Big Sur', lat: 36.3715, lng: -121.9017 },
  { name: 'Santa Barbara Pier', lat: 34.4100, lng: -119.6858 },
  { name: 'Santa Monica Pier', lat: 34.0094, lng: -118.4973 },
];

const PALETTES = [
  ['#F97316', '#7C3AED'],
  ['#0EA5E9', '#14B8A6'],
  ['#22C55E', '#065F46'],
  ['#F59E0B', '#DB2777'],
  ['#6366F1', '#0F172A'],
];

async function placeholderPhoto(name: string, index: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const [a, b] = PALETTES[index % PALETTES.length];
  const g = ctx.createLinearGradient(0, 0, 960, 720);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 720);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(0, 720);
  ctx.lineTo(320, 380);
  ctx.lineTo(520, 560);
  ctx.lineTo(720, 300);
  ctx.lineTo(960, 620);
  ctx.lineTo(960, 720);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '700 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 480, 320, 880);
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('sample photo', 480, 380);
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85));
}

export async function loadSampleTrip(): Promise<TripStop[]> {
  return Promise.all(
    SAMPLE_TRIP.map(async (c, i) => {
      const photo = await placeholderPhoto(c.name, i);
      return {
        id: `sample-${i}`,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        photo,
        photoUrl: URL.createObjectURL(photo),
        takenAt: null,
      };
    })
  );
}

/** A readable default name for photo coordinates: the nearest known city. */
export function describeLocation(lat: number, lng: number): string {
  const here = { name: '', lat, lng };
  let best: City | null = null;
  let bestMiles = Infinity;
  for (const c of POPULAR_CITIES) {
    const miles = getDistance(here, c);
    if (miles < bestMiles) {
      best = c;
      bestMiles = miles;
    }
  }
  if (best && bestMiles < 40) return `Near ${best.name}`;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
