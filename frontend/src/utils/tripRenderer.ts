// Draws one frame of the trip video onto a canvas: base map, route, stop
// markers, the car, and at each stop a pulsing highlight with the photo card.

import type { TransportMode } from '../types/travel';
import { drawTiles, toScreen, TILE_ATTRIBUTION, type TileCache, type Viewport } from './mapTiles';
import { TRANSPORT_CONFIG, TRANSPORT_ICON_PATHS } from './transportIcons';
import { sampleTimeline, type Frame, type Timeline } from './tripTimeline';

export interface PhotoImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderInput {
  timeline: Timeline;
  timeMs: number;
  viewport: Viewport;
  tiles: TileCache;
  photos: (PhotoImage | null)[];
  transport: TransportMode;
  title: string;
}

const HIGHLIGHT = '#F97316';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, font: string, bg: string) {
  ctx.font = font;
  const padX = 14;
  const w = ctx.measureText(text).width + padX * 2;
  const h = parseInt(font.match(/(\d+)px/)?.[1] ?? '16', 10) * 1.9;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = bg;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

function drawRoute(ctx: CanvasRenderingContext2D, input: RenderInput, frame: Frame, unit: number) {
  const { stops } = input.timeline;
  if (stops.length < 2) return;
  const pts = stops.map(s => toScreen(s.lat, s.lng, frame.camera, input.viewport));
  const color = TRANSPORT_CONFIG[input.transport].color;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Planned route, faded and dashed.
  ctx.setLineDash([unit * 1.2, unit * 1.4]);
  ctx.strokeStyle = 'rgba(30,41,59,0.45)';
  ctx.lineWidth = unit * 0.45;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();

  // Driven so far, solid with a white casing.
  const full = Math.floor(frame.legsTraveled);
  const partial = frame.legsTraveled - full;
  const driven = pts.slice(0, full + 1);
  if (partial > 0 && full + 1 < pts.length) {
    driven.push(toScreen(frame.vehicle[0], frame.vehicle[1], frame.camera, input.viewport));
  }
  if (driven.length > 1) {
    ctx.setLineDash([]);
    for (const [style, width] of [['white', unit * 1.1], [color, unit * 0.65]] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      driven.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStopMarkers(ctx: CanvasRenderingContext2D, input: RenderInput, frame: Frame, unit: number) {
  input.timeline.stops.forEach((s, i) => {
    if (i === frame.activeStop) return; // drawn by the highlight
    const [x, y] = toScreen(s.lat, s.lng, frame.camera, input.viewport);
    const reached = i < frame.reachedStops;
    ctx.beginPath();
    ctx.arc(x, y, unit * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = reached ? HIGHLIGHT : 'white';
    ctx.fill();
    ctx.lineWidth = unit * 0.3;
    ctx.strokeStyle = reached ? 'white' : '#334155';
    ctx.stroke();
    ctx.fillStyle = reached ? 'white' : '#334155';
    ctx.font = `700 ${Math.round(unit * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + 1);
  });
}

function drawHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, timeMs: number) {
  // Two expanding rings, offset in phase, around a solid pin.
  for (const offset of [0, 0.5]) {
    const phase = ((timeMs / 1400) + offset) % 1;
    ctx.beginPath();
    ctx.arc(x, y, unit * (1.2 + phase * 4.5), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(249,115,22,${0.7 * (1 - phase)})`;
    ctx.lineWidth = unit * 0.45;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, unit * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(249,115,22,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, unit * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = HIGHLIGHT;
  ctx.fill();
  ctx.lineWidth = unit * 0.35;
  ctx.strokeStyle = 'white';
  ctx.stroke();
}

const iconPaths = new Map<TransportMode, Path2D>();

function drawVehicle(ctx: CanvasRenderingContext2D, mode: TransportMode, x: number, y: number, bearing: number, unit: number) {
  let path = iconPaths.get(mode);
  if (!path) {
    path = new Path2D(TRANSPORT_ICON_PATHS[mode]);
    iconPaths.set(mode, path);
  }
  const r = unit * 2.1;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = unit;
  ctx.shadowOffsetY = unit * 0.25;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  // Planes point along the bearing; ground vehicles stay upright and are
  // mirrored when heading west.
  if (mode === 'flight') ctx.rotate((bearing - 90) * Math.PI / 180);
  else if (bearing > 180) ctx.scale(-1, 1);
  const s = (r * 1.25) / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  ctx.fillStyle = TRANSPORT_CONFIG[mode].color;
  ctx.fill(path);
  ctx.restore();
}

function drawPhotoCard(
  ctx: CanvasRenderingContext2D,
  photo: PhotoImage | null,
  name: string,
  stopNumber: number,
  anchorX: number,
  anchorY: number,
  opacity: number,
  viewport: Viewport,
  unit: number
) {
  const border = unit * 0.6;
  const captionH = unit * 3.2;
  const pointerH = unit * 1.6;
  const maxW = viewport.width * 0.82;
  // Keep clear of the header pill at the top.
  const maxH = anchorY - pointerH - captionH - border * 2 - unit * 9.5;
  const aspect = photo ? photo.width / photo.height : 4 / 3;
  let imgW = maxW - border * 2;
  let imgH = imgW / aspect;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * aspect;
  }
  const cardW = imgW + border * 2;
  const cardH = imgH + border * 2 + captionH;
  const x = anchorX - cardW / 2;
  const y = anchorY - unit * 2.2 - pointerH - cardH;

  ctx.save();
  ctx.globalAlpha = opacity;
  const scale = 0.92 + 0.08 * opacity;
  ctx.translate(anchorX, anchorY);
  ctx.scale(scale, scale);
  ctx.translate(-anchorX, -anchorY);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = unit * 2;
  ctx.shadowOffsetY = unit * 0.5;
  ctx.fillStyle = 'white';
  roundRect(ctx, x, y, cardW, cardH, unit * 1.2);
  ctx.fill();
  ctx.restore();

  // Pointer from the card down to the highlighted location.
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(anchorX - pointerH, y + cardH - 1);
  ctx.lineTo(anchorX + pointerH, y + cardH - 1);
  ctx.lineTo(anchorX, y + cardH + pointerH);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  roundRect(ctx, x + border, y + border, imgW, imgH, unit * 0.7);
  ctx.clip();
  if (photo) {
    ctx.drawImage(photo.source, x + border, y + border, imgW, imgH);
  } else {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(x + border, y + border, imgW, imgH);
  }
  ctx.restore();

  ctx.fillStyle = HIGHLIGHT;
  ctx.font = `700 ${Math.round(unit * 1.05)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textX = x + border + unit * 0.4;
  const textY = y + border + imgH + captionH / 2;
  const badge = `STOP ${stopNumber}`;
  ctx.fillText(badge, textX, textY);
  const badgeW = ctx.measureText(badge).width;
  ctx.fillStyle = '#0F172A';
  ctx.font = `600 ${Math.round(unit * 1.35)}px system-ui, sans-serif`;
  let label = name;
  const room = cardW - border * 2 - badgeW - unit * 1.6;
  while (label.length > 1 && ctx.measureText(label).width > room) label = label.slice(0, -2) + '…';
  ctx.fillText(label, textX + badgeW + unit * 0.8, textY);
  ctx.restore();
}

/** Renders the frame at input.timeMs and returns it (for callers that need state). */
export function renderTripFrame(ctx: CanvasRenderingContext2D, input: RenderInput): Frame {
  const { viewport, timeline } = input;
  const frame = sampleTimeline(timeline, input.timeMs, viewport);
  const unit = Math.min(viewport.width, viewport.height) / 60;

  ctx.fillStyle = '#E8EEF2';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  drawTiles(ctx, input.tiles, frame.camera, viewport);

  drawRoute(ctx, input, frame, unit);
  drawStopMarkers(ctx, input, frame, unit);

  if (frame.activeStop >= 0) {
    const s = timeline.stops[frame.activeStop];
    const [x, y] = toScreen(s.lat, s.lng, frame.camera, viewport);
    drawHighlight(ctx, x, y, unit, input.timeMs);
  }

  const [vx, vy] = toScreen(frame.vehicle[0], frame.vehicle[1], frame.camera, viewport);
  const parked = frame.activeStop >= 0;
  drawVehicle(ctx, input.transport, parked ? vx + unit * 3 : vx, parked ? vy + unit * 2 : vy, frame.bearing, unit);

  if (frame.activeStop >= 0 && frame.photoOpacity > 0) {
    const s = timeline.stops[frame.activeStop];
    const [x, y] = toScreen(s.lat, s.lng, frame.camera, viewport);
    drawPhotoCard(ctx, input.photos[frame.activeStop] ?? null, s.name, frame.activeStop + 1,
      x, y, frame.photoOpacity, viewport, unit);
  }

  // Header: trip title during the overview, otherwise progress.
  const headerY = unit * 4;
  if (frame.segment.kind === 'intro' || frame.segment.kind === 'outro') {
    pill(ctx, input.title, viewport.width / 2, headerY, `700 ${Math.round(unit * 1.8)}px system-ui, sans-serif`, 'rgba(15,23,42,0.85)');
  } else {
    const n = timeline.stops.length;
    const next = frame.segment.kind === 'travel' ? frame.segment.legIndex + 1 : frame.activeStop;
    const text = frame.segment.kind === 'travel'
      ? `${TRANSPORT_CONFIG[input.transport].emoji}  ${timeline.stops[next].name} · ${Math.round(frame.segment.miles)} mi`
      : `Stop ${frame.activeStop + 1} of ${n}`;
    pill(ctx, text, viewport.width / 2, headerY, `600 ${Math.round(unit * 1.4)}px system-ui, sans-serif`, 'rgba(15,23,42,0.8)');
  }

  ctx.font = `${Math.round(unit * 0.8)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(15,23,42,0.6)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(TILE_ATTRIBUTION, viewport.width - unit * 0.6, viewport.height - unit * 0.5);

  return frame;
}
