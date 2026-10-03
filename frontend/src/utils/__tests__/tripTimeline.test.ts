import { describe, expect, it } from 'vitest';
import { buildTimeline, sampleTimeline, travelDuration, DEFAULT_TIMELINE_OPTIONS } from '../tripTimeline';
import { fitZoom, project, toScreen, visibleTiles } from '../mapTiles';

const stops = [
  { name: 'A', lat: 37.8199, lng: -122.4783 },
  { name: 'B', lat: 36.6182, lng: -121.9019 },
  { name: 'C', lat: 34.0094, lng: -118.4973 },
];
const viewport = { width: 720, height: 1280 };

describe('buildTimeline', () => {
  it('alternates stops and drives between an intro and an outro', () => {
    const tl = buildTimeline(stops);
    expect(tl.segments.map(s => s.kind)).toEqual(['intro', 'stop', 'travel', 'stop', 'travel', 'stop', 'outro']);
    for (let i = 1; i < tl.segments.length; i++) {
      expect(tl.segments[i].start).toBe(tl.segments[i - 1].end);
    }
    expect(tl.totalMs).toBe(tl.segments[tl.segments.length - 1].end);
  });

  it('gives longer drives more time, within bounds', () => {
    const o = DEFAULT_TIMELINE_OPTIONS;
    expect(travelDuration(0, o)).toBe(o.minTravelMs);
    expect(travelDuration(5000, o)).toBe(o.maxTravelMs);
    expect(travelDuration(50, o)).toBeLessThan(travelDuration(300, o));
  });

  it('rejects an empty trip', () => {
    expect(() => buildTimeline([])).toThrow();
  });
});

describe('sampleTimeline', () => {
  const tl = buildTimeline(stops);
  const seg = (kind: string, n = 0) => tl.segments.filter(s => s.kind === kind)[n];

  it('pauses at each stop with the camera on it and the photo shown', () => {
    const s = seg('stop', 1);
    const mid = sampleTimeline(tl, (s.start + s.end) / 2, viewport);
    expect(mid.activeStop).toBe(1);
    expect(mid.photoOpacity).toBe(1);
    expect(mid.camera.lat).toBeCloseTo(stops[1].lat);
    expect(mid.camera.zoom).toBeCloseTo(DEFAULT_TIMELINE_OPTIONS.stopZoom);
    expect(mid.vehicle).toEqual([stops[1].lat, stops[1].lng]);
    expect(sampleTimeline(tl, s.start + 10, viewport).photoOpacity).toBe(0);
  });

  it('moves the vehicle along the leg and follows it with the camera', () => {
    const s = seg('travel', 0);
    const start = sampleTimeline(tl, s.start, viewport);
    const mid = sampleTimeline(tl, (s.start + s.end) / 2, viewport);
    expect(start.vehicle[0]).toBeCloseTo(stops[0].lat);
    expect(mid.vehicle[0]).toBeCloseTo((stops[0].lat + stops[1].lat) / 2);
    expect(mid.camera.lat).toBe(mid.vehicle[0]);
    expect(mid.legsTraveled).toBeCloseTo(0.5);
    expect(mid.activeStop).toBe(-1);
  });

  it('keeps the camera continuous across segment boundaries', () => {
    for (const s of tl.segments.slice(1)) {
      const before = sampleTimeline(tl, s.start - 1, viewport).camera;
      const after = sampleTimeline(tl, s.start + 1, viewport).camera;
      expect(Math.abs(before.zoom - after.zoom)).toBeLessThan(0.05);
      expect(Math.abs(before.lat - after.lat)).toBeLessThan(0.01);
    }
  });

  it('works for a single-stop trip', () => {
    const one = buildTimeline([stops[0]]);
    const f = sampleTimeline(one, one.totalMs / 2, viewport);
    expect(f.activeStop).toBe(0);
  });
});

describe('map projection', () => {
  it('projects the origin to the world center', () => {
    expect(project(0, 0, 0)).toEqual([128, 128]);
  });

  it('places the camera center at the viewport center', () => {
    const cam = { lat: 36, lng: -121, zoom: 9.3 };
    const [x, y] = toScreen(36, -121, cam, viewport);
    expect(x).toBeCloseTo(360);
    expect(y).toBeCloseTo(640);
  });

  it('fits points inside the viewport', () => {
    const z = fitZoom(stops, viewport, 50);
    for (const s of stops) {
      const mid = { lat: (34.0094 + 37.8199) / 2, lng: (-122.4783 + -118.4973) / 2, zoom: z };
      const [x, y] = toScreen(s.lat, s.lng, mid, viewport);
      expect(x).toBeGreaterThanOrEqual(49);
      expect(x).toBeLessThanOrEqual(671);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1280);
    }
  });

  it('covers the whole viewport with tiles', () => {
    const tiles = visibleTiles({ lat: 36, lng: -121, zoom: 9.6 }, viewport);
    const minX = Math.min(...tiles.map(t => t.dx));
    const minY = Math.min(...tiles.map(t => t.dy));
    const maxX = Math.max(...tiles.map(t => t.dx + t.size));
    const maxY = Math.max(...tiles.map(t => t.dy + t.size));
    expect(minX).toBeLessThanOrEqual(0);
    expect(minY).toBeLessThanOrEqual(0);
    expect(maxX).toBeGreaterThanOrEqual(720);
    expect(maxY).toBeGreaterThanOrEqual(1280);
  });
});
