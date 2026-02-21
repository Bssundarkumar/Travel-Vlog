import { useState, useRef, useCallback, useEffect } from 'react';
import type { City, TransportMode, AnimationState } from './types/travel';
import CityAutocomplete from './components/CityAutocomplete';
import TransportSelector from './components/TransportSelector';
import PhotoUploader from './components/PhotoUploader';
import TravelMap from './components/TravelMap';
import { TRANSPORT_CONFIG } from './utils/transportIcons';
import { getDistance } from './utils/cities';
import './App.css';

const PHASE_DURATIONS = {
  'zoom-out': 2000,
  'travel': 6000,
  'zoom-in': 2500,
  'photo-each': 3000,
};

export default function App() {
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [transport, setTransport] = useState<TransportMode>('flight');
  const [photos, setPhotos] = useState<File[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(-1);
  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    isRecording: false,
    progress: 0,
    phase: 'idle',
  });

  const animFrameRef = useRef<number>(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const canStart = origin !== null && destination !== null;

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setAnimationState({
      isPlaying: false,
      isRecording: false,
      progress: 0,
      phase: 'idle',
    });
    setCurrentPhotoIndex(-1);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!mapContainerRef.current) return;

    const canvas = mapContainerRef.current.querySelector('canvas');
    let stream: MediaStream;

    if (canvas) {
      stream = canvas.captureStream(30);
    } else {
      // Fallback: record is not available without canvas
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travel-${origin?.name.split(',')[0]}-to-${destination?.name.split(',')[0]}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
  }, [origin, destination]);

  const runAnimation = useCallback((record: boolean) => {
    if (!origin || !destination) return;

    const hasPhotos = photos.length > 0;

    if (record) startRecording();

    setAnimationState({
      isPlaying: true,
      isRecording: record,
      progress: 0,
      phase: 'zoom-out',
    });

    const timeline: { phase: AnimationState['phase']; duration: number }[] = [
      { phase: 'zoom-out', duration: PHASE_DURATIONS['zoom-out'] },
      { phase: 'travel', duration: PHASE_DURATIONS['travel'] },
      { phase: 'zoom-in', duration: PHASE_DURATIONS['zoom-in'] },
    ];

    if (hasPhotos) {
      timeline.push({ phase: 'photos', duration: photos.length * PHASE_DURATIONS['photo-each'] });
    }

    let currentPhaseIdx = 0;
    let phaseStartTime = performance.now();
    let photoIdx = 0;

    function tick(now: number) {
      if (currentPhaseIdx >= timeline.length) {
        setAnimationState(prev => ({ ...prev, phase: 'done', isPlaying: false }));
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setTimeout(() => {
          setAnimationState({
            isPlaying: false,
            isRecording: false,
            progress: 0,
            phase: 'idle',
          });
          setCurrentPhotoIndex(-1);
        }, 1500);
        return;
      }

      const phase = timeline[currentPhaseIdx];
      const elapsed = now - phaseStartTime;
      const progress = Math.min(elapsed / phase.duration, 1);

      if (phase.phase === 'travel') {
        // Eased progress for smoother travel
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        setAnimationState(prev => ({
          ...prev,
          phase: 'travel',
          progress: eased,
        }));
      } else if (phase.phase === 'photos') {
        const newPhotoIdx = Math.min(
          Math.floor(progress * photos.length),
          photos.length - 1
        );
        if (newPhotoIdx !== photoIdx) {
          photoIdx = newPhotoIdx;
          setCurrentPhotoIndex(photoIdx);
        }
        setAnimationState(prev => ({
          ...prev,
          phase: 'photos',
          progress,
        }));
      } else {
        setAnimationState(prev => ({
          ...prev,
          phase: phase.phase,
          progress,
        }));
      }

      if (progress >= 1) {
        currentPhaseIdx++;
        phaseStartTime = now;
        if (currentPhaseIdx < timeline.length) {
          const nextPhase = timeline[currentPhaseIdx];
          setAnimationState(prev => ({
            ...prev,
            phase: nextPhase.phase,
            progress: 0,
          }));
          if (nextPhase.phase === 'photos') {
            photoIdx = 0;
            setCurrentPhotoIndex(0);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [origin, destination, photos, startRecording]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const distance = origin && destination ? Math.round(getDistance(origin, destination)) : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600
                          flex items-center justify-center text-lg">
            {'\uD83C\uDF0D'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Travel Vlog Creator</h1>
            <p className="text-xs text-gray-400">Create animated travel videos</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-gray-800
                         bg-gray-900/50 p-6 overflow-y-auto">
          <div className="space-y-6">
            <CityAutocomplete
              label="Origin City"
              value={origin}
              onChange={setOrigin}
              placeholder="e.g. Richmond, VA"
            />

            <CityAutocomplete
              label="Destination City"
              value={destination}
              onChange={setDestination}
              placeholder="e.g. Miami, FL"
            />

            {distance !== null && (
              <div className="bg-gray-800/50 rounded-lg px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-gray-400">Distance</span>
                <span className="text-sm font-semibold text-white">
                  {distance.toLocaleString()} miles
                </span>
              </div>
            )}

            <TransportSelector value={transport} onChange={setTransport} />

            <PhotoUploader photos={photos} onChange={setPhotos} />

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {!animationState.isPlaying ? (
                <>
                  <button
                    onClick={() => runAnimation(false)}
                    disabled={!canStart}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                             disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
                             flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Preview Animation
                  </button>

                  <button
                    onClick={() => runAnimation(true)}
                    disabled={!canStart}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700
                             disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
                             flex items-center justify-center gap-2"
                  >
                    <div className="w-3 h-3 rounded-full bg-white" />
                    Record Video
                  </button>
                </>
              ) : (
                <button
                  onClick={stopAnimation}
                  className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white
                           font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                  Stop
                </button>
              )}
            </div>

            {/* Status */}
            {animationState.isPlaying && (
              <div className="bg-gray-800/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  {animationState.isRecording && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 recording-indicator" />
                  )}
                  <span className="text-sm text-gray-300">
                    {animationState.phase === 'zoom-out' && 'Setting up the journey...'}
                    {animationState.phase === 'travel' && `${TRANSPORT_CONFIG[transport].emoji} Traveling...`}
                    {animationState.phase === 'zoom-in' && 'Arriving at destination...'}
                    {animationState.phase === 'photos' && 'Showing destination photos...'}
                    {animationState.phase === 'done' && 'Complete!'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main ref={mapContainerRef} className="flex-1 min-h-[400px] lg:min-h-0 relative">
          <TravelMap
            origin={origin}
            destination={destination}
            transport={transport}
            animationState={animationState}
            photos={photos}
            currentPhotoIndex={currentPhotoIndex}
          />

          {/* Empty state */}
          {!origin && !destination && (
            <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
              <div className="text-center bg-gray-900/80 backdrop-blur-sm px-8 py-6 rounded-xl border border-gray-800">
                <p className="text-4xl mb-3">{'\uD83D\uDDFA\uFE0F'}</p>
                <p className="text-gray-300 font-medium">Select your origin and destination</p>
                <p className="text-gray-500 text-sm mt-1">Choose cities and transport mode to create your travel video</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
