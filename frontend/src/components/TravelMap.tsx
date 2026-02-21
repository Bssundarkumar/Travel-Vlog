import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { City, TransportMode, AnimationState } from '../types/travel';
import { getTransportSvgIcon, TRANSPORT_CONFIG } from '../utils/transportIcons';
import { interpolatePosition, getBearing, generateArcPoints, getRouteBounds } from '../utils/geo';
import { getDistance } from '../utils/cities';

import 'leaflet/dist/leaflet.css';

interface TravelMapProps {
  origin: City | null;
  destination: City | null;
  transport: TransportMode;
  animationState: AnimationState;
  photos: File[];
  currentPhotoIndex: number;
}

function createCityIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-city-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createTransportIcon(mode: TransportMode, bearing: number): L.DivIcon {
  const svg = getTransportSvgIcon(mode, 36);
  const rotation = mode === 'flight' ? bearing - 90 : (bearing > 90 && bearing < 270 ? 180 : 0);

  return L.divIcon({
    className: 'transport-marker',
    html: `<div style="
      transform: rotate(${rotation}deg);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      display: flex;
      align-items: center;
      justify-content: center;
    ">${svg}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createLabelIcon(text: string, position: 'origin' | 'destination'): L.DivIcon {
  const bgColor = position === 'origin' ? '#10B981' : '#EF4444';
  return L.divIcon({
    className: 'city-label',
    html: `<div style="
      background: ${bgColor};
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-family: system-ui, sans-serif;
    ">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, -12],
  });
}

function AnimationController({
  origin,
  destination,
  animationState,
}: {
  origin: City;
  destination: City;
  animationState: AnimationState;
}) {
  const map = useMap();

  useEffect(() => {
    if (animationState.phase === 'idle') {
      const bounds = getRouteBounds(origin, destination);
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1 });
    } else if (animationState.phase === 'zoom-out') {
      const bounds = getRouteBounds(origin, destination);
      map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1.5 });
    } else if (animationState.phase === 'zoom-in') {
      map.flyTo([destination.lat, destination.lng], 12, { duration: 2 });
    } else if (animationState.phase === 'photos') {
      map.flyTo([destination.lat, destination.lng], 13, { duration: 1 });
    }
  }, [map, origin, destination, animationState.phase]);

  useEffect(() => {
    if (animationState.phase === 'travel') {
      const t = animationState.progress;
      const pos = interpolatePosition(origin, destination, t);
      const distance = getDistance(origin, destination);
      const zoomForDistance = distance > 1500 ? 4 : distance > 800 ? 5 : distance > 400 ? 6 : 7;
      map.setView(pos, zoomForDistance, { animate: false });
    }
  }, [map, origin, destination, animationState.phase, animationState.progress]);

  return null;
}

export default function TravelMap({
  origin,
  destination,
  transport,
  animationState,
  photos,
  currentPhotoIndex,
}: TravelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  const routePoints = useMemo(() => {
    if (!origin || !destination) return [];
    const distance = getDistance(origin, destination);
    const arcHeight = transport === 'flight' ? Math.min(distance / 500, 3) : 0;
    return generateArcPoints(origin, destination, 200, arcHeight);
  }, [origin, destination, transport]);

  const vehiclePosition = useMemo(() => {
    if (!origin || !destination || animationState.phase !== 'travel') return null;
    return interpolatePosition(origin, destination, animationState.progress);
  }, [origin, destination, animationState.phase, animationState.progress]);

  const bearing = useMemo(() => {
    if (!origin || !destination) return 0;
    return getBearing(origin, destination);
  }, [origin, destination]);

  const trailPoints = useMemo(() => {
    if (!origin || !destination || animationState.phase !== 'travel') return [];
    const idx = Math.floor(animationState.progress * routePoints.length);
    return routePoints.slice(0, idx + 1);
  }, [origin, destination, animationState.phase, animationState.progress, routePoints]);

  const transportColor = TRANSPORT_CONFIG[transport].color;

  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  const photoUrl = useMemo(() => {
    if (animationState.phase !== 'photos' || photos.length === 0 || currentPhotoIndex < 0) return null;
    return URL.createObjectURL(photos[currentPhotoIndex]);
  }, [animationState.phase, photos, currentPhotoIndex]);

  return (
    <div ref={mapRef} className="relative w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {origin && destination && (
          <AnimationController
            origin={origin}
            destination={destination}
            animationState={animationState}
          />
        )}

        {/* Full route path (faded) */}
        {routePoints.length > 0 && animationState.phase !== 'idle' && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: transportColor,
              weight: 3,
              opacity: 0.2,
              dashArray: '8 12',
            }}
          />
        )}

        {/* Traveled trail */}
        {trailPoints.length > 0 && (
          <Polyline
            positions={trailPoints}
            pathOptions={{
              color: transportColor,
              weight: 4,
              opacity: 0.8,
            }}
          />
        )}

        {/* Origin marker */}
        {origin && (
          <>
            <Marker
              position={[origin.lat, origin.lng]}
              icon={createCityIcon('#10B981')}
            />
            <Marker
              position={[origin.lat, origin.lng]}
              icon={createLabelIcon(origin.name.split(',')[0], 'origin')}
            />
          </>
        )}

        {/* Destination marker */}
        {destination && (
          <>
            <Marker
              position={[destination.lat, destination.lng]}
              icon={createCityIcon('#EF4444')}
            />
            <Marker
              position={[destination.lat, destination.lng]}
              icon={createLabelIcon(destination.name.split(',')[0], 'destination')}
            />
          </>
        )}

        {/* Moving transport icon */}
        {vehiclePosition && (
          <Marker
            position={vehiclePosition}
            icon={createTransportIcon(transport, bearing)}
          />
        )}
      </MapContainer>

      {/* Title overlay during zoom-out */}
      {animationState.phase === 'zoom-out' && origin && destination && (
        <div className="absolute inset-0 flex items-start justify-center pt-8 z-[1000] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white text-center">
              {origin.name.split(',')[0]} → {destination.name.split(',')[0]}
            </h2>
            <p className="text-center text-sm text-gray-300 mt-1">
              {TRANSPORT_CONFIG[transport].emoji} Traveling by {TRANSPORT_CONFIG[transport].label}
            </p>
          </div>
        </div>
      )}

      {/* Distance/progress overlay during travel */}
      {animationState.phase === 'travel' && origin && destination && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">
                {TRANSPORT_CONFIG[transport].emoji} {origin.name.split(',')[0]}
              </span>
              <span className="text-sm text-gray-300">
                {destination.name.split(',')[0]}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-75"
                style={{
                  width: `${animationState.progress * 100}%`,
                  backgroundColor: transportColor,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center mt-1.5">
              {Math.round(getDistance(origin, destination))} miles
            </p>
          </div>
        </div>
      )}

      {/* Photo overlay at destination */}
      {animationState.phase === 'photos' && photoUrl && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="relative max-w-[80%] max-h-[80%]">
            <img
              src={photoUrl}
              alt={`Destination photo ${currentPhotoIndex + 1}`}
              className="max-w-full max-h-[70vh] rounded-xl shadow-2xl border-2 border-white/20
                         object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent
                            px-4 py-3 rounded-b-xl">
              <p className="text-white text-sm font-medium text-center">
                {destination?.name} - Photo {currentPhotoIndex + 1} of {photos.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Arrival overlay */}
      {animationState.phase === 'zoom-in' && destination && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm px-8 py-4 rounded-xl border border-white/10
                          animate-pulse">
            <h2 className="text-2xl font-bold text-white text-center">
              Welcome to {destination.name.split(',')[0]}!
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
