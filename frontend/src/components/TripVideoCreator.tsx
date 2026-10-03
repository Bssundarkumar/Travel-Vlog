import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { City, TransportMode, TripStop, VideoFormat } from '../types/travel';
import CityAutocomplete from './CityAutocomplete';
import TransportSelector from './TransportSelector';
import { readFileMetadata } from '../utils/exif';
import { TileCache, visibleTiles, type TileRef, type Viewport } from '../utils/mapTiles';
import { buildTimeline, sampleTimeline, type Timeline } from '../utils/tripTimeline';
import { renderTripFrame, type PhotoImage } from '../utils/tripRenderer';
import { recordCanvas, extensionFor } from '../utils/videoRecorder';
import { describeLocation, loadSampleTrip } from '../utils/sampleTrip';

const VIEWPORTS: Record<VideoFormat, Viewport> = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
};

type Status =
  | { kind: 'idle' }
  | { kind: 'preparing'; message: string }
  | { kind: 'playing'; recording: boolean };

let nextId = 0;

function located(stops: TripStop[]): (TripStop & { lat: number; lng: number })[] {
  return stops.filter((s): s is TripStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null);
}

async function loadPhotos(stops: TripStop[]): Promise<(PhotoImage | null)[]> {
  return Promise.all(
    stops.map(async s => {
      if (!s.photo) return null;
      try {
        const bmp = await createImageBitmap(s.photo);
        return { source: bmp, width: bmp.width, height: bmp.height };
      } catch {
        return null; // e.g. HEIC in a browser that can't decode it
      }
    })
  );
}

/** Every tile any frame will need, sampled a few times per second. */
function tilesForTimeline(tl: Timeline, viewport: Viewport): TileRef[] {
  const tiles: TileRef[] = [];
  for (let t = 0; t <= tl.totalMs; t += 100) {
    const { camera } = sampleTimeline(tl, t, viewport);
    for (const v of visibleTiles(camera, viewport)) tiles.push(v.tile);
  }
  return tiles;
}

export default function TripVideoCreator() {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [title, setTitle] = useState('My Road Trip');
  const [transport, setTransport] = useState<TransportMode>('car');
  const [format, setFormat] = useState<VideoFormat>('portrait');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [scrubMs, setScrubMs] = useState(0);
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tilesRef = useRef<TileCache | null>(null);
  const photosRef = useRef<(PhotoImage | null)[]>([]);
  const rafRef = useRef(0);
  const cancelledRef = useRef(false);

  const viewport = VIEWPORTS[format];
  const routeStops = located(stops);
  const missingLocation = stops.length - routeStops.length;

  const timeline = useMemo<Timeline | null>(() => {
    const cities: City[] = located(stops).map(s => ({ name: s.name, lat: s.lat, lng: s.lng }));
    return cities.length > 0 ? buildTimeline(cities) : null;
  }, [stops]);

  const getTiles = () => (tilesRef.current ??= new TileCache());

  const draw = useCallback((timeMs: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !timeline) return;
    renderTripFrame(ctx, {
      timeline,
      timeMs,
      viewport,
      tiles: getTiles(),
      photos: photosRef.current,
      transport,
      title,
    });
  }, [timeline, viewport, transport, title]);

  // Keep photo bitmaps in step with the located stops.
  useEffect(() => {
    let live = true;
    loadPhotos(located(stops)).then(p => {
      if (!live) return;
      photosRef.current = p;
      if (status.kind === 'idle') draw(scrubMs);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  // When idle, show the scrubbed frame and repaint as tiles arrive.
  useEffect(() => {
    if (status.kind !== 'idle') return;
    const tiles = getTiles();
    let pending = 0;
    tiles.onTileLoaded = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => draw(scrubMs));
    };
    draw(scrubMs);
    return () => {
      tiles.onTileLoaded = null;
      cancelAnimationFrame(pending);
    };
  }, [status.kind, draw, scrubMs]);

  useEffect(() => () => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
  }, []);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    const added = await Promise.all(
      Array.from(files).map(async (file): Promise<TripStop> => {
        const meta = await readFileMetadata(file);
        const hasGps = meta.lat !== null && meta.lng !== null;
        return {
          id: `stop-${nextId++}`,
          name: hasGps ? describeLocation(meta.lat!, meta.lng!) : file.name.replace(/\.[^.]+$/, ''),
          lat: meta.lat,
          lng: meta.lng,
          photo: file,
          photoUrl: URL.createObjectURL(file),
          takenAt: meta.takenAt,
        };
      })
    );
    setStops(prev => {
      const all = [...prev, ...added];
      // Photos carry their capture time, so order the trip by it when we can.
      if (all.every(s => s.takenAt)) all.sort((a, b) => a.takenAt!.getTime() - b.takenAt!.getTime());
      return all;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function updateStop(id: string, patch: Partial<TripStop>) {
    setStops(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveStop(index: number, delta: number) {
    setStops(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStop(id: string) {
    setStops(prev => {
      const gone = prev.find(s => s.id === id);
      if (gone?.photoUrl) URL.revokeObjectURL(gone.photoUrl);
      return prev.filter(s => s.id !== id);
    });
  }

  async function useSample() {
    stops.forEach(s => s.photoUrl && URL.revokeObjectURL(s.photoUrl));
    setStops(await loadSampleTrip());
    setTitle('California Coast');
    setScrubMs(0);
  }

  function stop() {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setStatus({ kind: 'idle' });
  }

  async function play(record: boolean) {
    const canvas = canvasRef.current;
    if (!timeline || !canvas) return;
    setError(null);
    cancelledRef.current = false;
    if (record && video) {
      URL.revokeObjectURL(video.url);
      setVideo(null);
    }

    // Load every map tile up front so the recording never shows blank map.
    setStatus({ kind: 'preparing', message: 'Loading map…' });
    await getTiles().preload(tilesForTimeline(timeline, viewport), (done, total) => {
      if (!cancelledRef.current) setStatus({ kind: 'preparing', message: `Loading map ${done}/${total}…` });
    });
    if (cancelledRef.current) return;

    let recording: ReturnType<typeof recordCanvas> | null = null;
    if (record) {
      try {
        recording = recordCanvas(canvas);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus({ kind: 'idle' });
        return;
      }
    }

    setStatus({ kind: 'playing', recording: record });
    const start = performance.now();
    const tick = async (now: number) => {
      if (cancelledRef.current) {
        await recording?.stop();
        return;
      }
      const t = now - start;
      draw(Math.min(t, timeline.totalMs));
      if (t < timeline.totalMs) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (recording) {
        const blob = await recording.stop();
        const safeTitle = title.trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'trip';
        setVideo({ url: URL.createObjectURL(blob), name: `${safeTitle}.${extensionFor(recording.mimeType)}` });
      }
      setScrubMs(timeline.totalMs);
      setStatus({ kind: 'idle' });
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const busy = status.kind !== 'idle';
  const canPlay = !!timeline && !busy;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <aside className="w-full lg:w-[26rem] border-b lg:border-b-0 lg:border-r border-gray-800
                        bg-gray-900/50 p-6 overflow-y-auto space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Trip title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Stops ({stops.length})</span>
            <button
              type="button"
              onClick={useSample}
              disabled={busy}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
            >
              Load sample trip
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-full border-2 border-dashed border-gray-700 rounded-lg p-4 text-center
                       hover:border-blue-500/50 transition-colors text-gray-400 text-sm"
          >
            Add photos — location and time are read from each photo
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/*"
              onChange={e => addPhotos(e.target.files)}
              className="hidden"
            />
          </button>

          <ol className="mt-3 space-y-2">
            {stops.map((s, i) => (
              <li key={s.id} className="bg-gray-800/60 rounded-lg p-2.5 flex gap-3">
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt="" className="w-16 h-16 object-cover rounded-md shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-gray-700 shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-400 shrink-0">{i + 1}</span>
                    <input
                      value={s.name}
                      onChange={e => updateStop(s.id, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-sm text-gray-100 border-b border-gray-700
                                 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {s.lat !== null && s.lng !== null ? (
                    <p className="text-xs text-gray-500">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
                  ) : (
                    <div className="text-xs">
                      <p className="text-amber-400 mb-1">No location in this photo. Pick a place:</p>
                      <CityAutocomplete
                        label=""
                        value={null}
                        placeholder="Search city…"
                        onChange={c => c && updateStop(s.id, { lat: c.lat, lng: c.lng, name: c.name })}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-gray-400 text-xs">
                  <button type="button" onClick={() => moveStop(i, -1)} disabled={busy || i === 0}
                    className="hover:text-white disabled:opacity-30" aria-label="Move up">▲</button>
                  <button type="button" onClick={() => moveStop(i, 1)} disabled={busy || i === stops.length - 1}
                    className="hover:text-white disabled:opacity-30" aria-label="Move down">▼</button>
                  <button type="button" onClick={() => removeStop(s.id)} disabled={busy}
                    className="hover:text-red-400 disabled:opacity-30" aria-label="Remove">✕</button>
                </div>
              </li>
            ))}
          </ol>
          {missingLocation > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              {missingLocation} stop{missingLocation > 1 ? 's' : ''} without a location will be skipped.
            </p>
          )}
        </div>

        <TransportSelector value={transport} onChange={setTransport} />

        <div>
          <span className="block text-sm font-medium text-gray-300 mb-2">Video format</span>
          <div className="grid grid-cols-2 gap-2">
            {(['portrait', 'landscape'] as const).map(f => (
              <button
                key={f}
                type="button"
                disabled={busy}
                onClick={() => setFormat(f)}
                className={`py-2 rounded-lg text-sm border transition-colors ${format === f
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                {f === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {!busy ? (
            <>
              <button
                type="button"
                onClick={() => play(false)}
                disabled={!canPlay}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                           text-white font-semibold rounded-lg transition-colors"
              >
                ▶ Preview
              </button>
              <button
                type="button"
                onClick={() => play(true)}
                disabled={!canPlay}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500
                           text-white font-semibold rounded-lg transition-colors"
              >
                ● Record video
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg"
            >
              ■ Stop
            </button>
          )}
          {status.kind === 'preparing' && <p className="text-sm text-gray-400">{status.message}</p>}
          {status.kind === 'playing' && status.recording && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 recording-indicator" />
              Recording… keep this tab visible.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {video && (
            <a
              href={video.url}
              download={video.name}
              className="block w-full py-3 text-center bg-emerald-600 hover:bg-emerald-500 text-white
                         font-semibold rounded-lg"
            >
              Download {video.name}
            </a>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 min-h-[500px]">
        {timeline ? (
          <>
            <canvas
              ref={canvasRef}
              width={viewport.width}
              height={viewport.height}
              data-testid="trip-canvas"
              className="rounded-xl shadow-2xl border border-gray-800 bg-gray-900"
              style={{
                aspectRatio: `${viewport.width} / ${viewport.height}`,
                maxHeight: '75vh',
                maxWidth: '100%',
              }}
            />
            <input
              type="range"
              min={0}
              max={timeline.totalMs}
              step={50}
              value={Math.min(scrubMs, timeline.totalMs)}
              disabled={busy}
              onChange={e => setScrubMs(Number(e.target.value))}
              className="w-full max-w-xl"
              aria-label="Scrub timeline"
            />
            <p className="text-xs text-gray-500">
              {(timeline.totalMs / 1000).toFixed(1)}s video · {routeStops.length} stops
            </p>
          </>
        ) : (
          <div className="text-center bg-gray-900/80 px-8 py-6 rounded-xl border border-gray-800">
            <p className="text-4xl mb-3">{'🚗'}</p>
            <p className="text-gray-300 font-medium">Add geotagged photos to build a trip</p>
            <p className="text-gray-500 text-sm mt-1">or load the sample trip to try it out</p>
          </div>
        )}
      </main>
    </div>
  );
}
