// Turns an ordered list of stops into a timed script for the trip video:
// overview, then for each stop a pause (zoom in, show photo, zoom out) and a
// drive to the next stop, then a closing overview. Everything here is pure so
// the same frame can be rendered for preview, recording, or tile preloading.

import type { City } from '../types/travel';
import { getDistance } from './cities';
import { interpolatePosition, getBearing } from './geo';
import { fitZoom, type Camera, type Viewport } from './mapTiles';

export interface TimelineOptions {
  introMs: number;
  outroMs: number;
  stopMs: number;
  /** Part of each stop spent zooming in, and again zooming out. */
  stopZoomMs: number;
  minTravelMs: number;
  maxTravelMs: number;
  stopZoom: number;
}

export const DEFAULT_TIMELINE_OPTIONS: TimelineOptions = {
  introMs: 2000,
  outroMs: 2000,
  stopMs: 4000,
  stopZoomMs: 900,
  minTravelMs: 2500,
  maxTravelMs: 6000,
  stopZoom: 13,
};

export type Segment =
  | { kind: 'intro'; start: number; end: number }
  | { kind: 'stop'; stopIndex: number; start: number; end: number }
  | { kind: 'travel'; legIndex: number; miles: number; start: number; end: number }
  | { kind: 'outro'; start: number; end: number };

export interface Timeline {
  stops: City[];
  segments: Segment[];
  totalMs: number;
  options: TimelineOptions;
}

/** Longer drives get more screen time, within limits, so short hops don't drag. */
export function travelDuration(miles: number, opts: TimelineOptions): number {
  const t = Math.min(miles / 400, 1);
  return Math.round(opts.minTravelMs + (opts.maxTravelMs - opts.minTravelMs) * Math.sqrt(t));
}

export function buildTimeline(
  stops: City[],
  options: Partial<TimelineOptions> = {}
): Timeline {
  if (stops.length === 0) throw new Error('A trip needs at least one stop');
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  const segments: Segment[] = [];
  let t = 0;
  const push = (seg: Segment) => {
    segments.push(seg);
    t = seg.end;
  };

  push({ kind: 'intro', start: t, end: t + opts.introMs });
  stops.forEach((stop, i) => {
    push({ kind: 'stop', stopIndex: i, start: t, end: t + opts.stopMs });
    const next = stops[i + 1];
    if (next) {
      const miles = getDistance(stop, next);
      push({ kind: 'travel', legIndex: i, miles, start: t, end: t + travelDuration(miles, opts) });
    }
  });
  push({ kind: 'outro', start: t, end: t + opts.outroMs });

  return { stops, segments, totalMs: t, options: opts };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  return { lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t), zoom: lerp(a.zoom, b.zoom, t) };
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export interface Frame {
  segment: Segment;
  /** 0..1 progress through the current segment. */
  segmentProgress: number;
  camera: Camera;
  vehicle: [number, number];
  bearing: number;
  /** Route drawn so far, in legs: 1.5 means leg 0 done and leg 1 half driven. */
  legsTraveled: number;
  /** Stop being visited, or -1 when not paused at one. */
  activeStop: number;
  /** Stops reached so far (inclusive), for marker styling. */
  reachedStops: number;
  photoOpacity: number;
}

export function overviewCamera(stops: City[], viewport: Viewport): Camera {
  const lats = stops.map(s => s.lat);
  const lngs = stops.map(s => s.lng);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    zoom: Math.min(fitZoom(stops, viewport, Math.min(viewport.width, viewport.height) * 0.15), 11),
  };
}

/**
 * Zoom while driving a leg. The camera follows the vehicle, so the far end of
 * the leg can be a full leg-length from center: fit twice the leg's extent.
 */
export function legZoom(from: City, to: City, viewport: Viewport, stopZoom: number): number {
  const mirrored = { lat: 2 * from.lat - to.lat, lng: 2 * from.lng - to.lng };
  return Math.min(fitZoom([mirrored, to], viewport, 40), stopZoom - 1);
}

export function sampleTimeline(tl: Timeline, ms: number, viewport: Viewport): Frame {
  const { stops, segments, options: opts } = tl;
  const time = Math.max(0, Math.min(ms, tl.totalMs));
  const segment = segments.find(s => time < s.end) ?? segments[segments.length - 1];
  const p = clamp01((time - segment.start) / Math.max(segment.end - segment.start, 1));

  const overview = overviewCamera(stops, viewport);
  const zoomForLeg = (i: number) => legZoom(stops[i], stops[i + 1], viewport, opts.stopZoom);
  const stopCam = (i: number, zoom: number): Camera => ({ lat: stops[i].lat, lng: stops[i].lng, zoom });
  // Zoom used on arrival at / departure from each stop.
  const arrivalZoom = (i: number) => (i === 0 ? overview.zoom : zoomForLeg(i - 1));
  const departureZoom = (i: number) => (i < stops.length - 1 ? zoomForLeg(i) : arrivalZoom(i));

  const base = {
    segment,
    segmentProgress: p,
    bearing: 90,
    activeStop: -1,
    photoOpacity: 0,
  };

  switch (segment.kind) {
    case 'intro': {
      const move = easeInOut(clamp01((p - 0.4) / 0.6));
      return {
        ...base,
        camera: lerpCamera(overview, stopCam(0, arrivalZoom(0)), move),
        vehicle: [stops[0].lat, stops[0].lng],
        legsTraveled: 0,
        reachedStops: 1,
      };
    }
    case 'stop': {
      const i = segment.stopIndex;
      const elapsed = time - segment.start;
      const remaining = segment.end - time;
      const zoomIn = easeInOut(clamp01(elapsed / opts.stopZoomMs));
      const zoomOut = easeInOut(clamp01(1 - remaining / opts.stopZoomMs));
      const zoom = zoomOut > 0
        ? lerp(opts.stopZoom, departureZoom(i), zoomOut)
        : lerp(arrivalZoom(i), opts.stopZoom, zoomIn);
      const fade = 300;
      const photoOpacity = clamp01(Math.min(
        (elapsed - opts.stopZoomMs * 0.6) / fade,
        (remaining - opts.stopZoomMs * 0.6) / fade
      ));
      return {
        ...base,
        camera: stopCam(i, zoom),
        vehicle: [stops[i].lat, stops[i].lng],
        bearing: i > 0 ? getBearing(stops[i - 1], stops[i]) : 90,
        legsTraveled: i,
        activeStop: i,
        reachedStops: i + 1,
        photoOpacity,
      };
    }
    case 'travel': {
      const i = segment.legIndex;
      const eased = easeInOut(p);
      const vehicle = interpolatePosition(stops[i], stops[i + 1], eased);
      return {
        ...base,
        camera: { lat: vehicle[0], lng: vehicle[1], zoom: zoomForLeg(i) },
        vehicle,
        bearing: getBearing(stops[i], stops[i + 1]),
        legsTraveled: i + eased,
        reachedStops: i + 1,
      };
    }
    case 'outro': {
      const last = stops.length - 1;
      const move = easeInOut(clamp01(p / 0.6));
      return {
        ...base,
        camera: lerpCamera(stopCam(last, departureZoom(last)), overview, move),
        vehicle: [stops[last].lat, stops[last].lng],
        legsTraveled: last,
        reachedStops: stops.length,
      };
    }
  }
}
