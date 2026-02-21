import type { City } from '../types/travel';
import type { LatLngBoundsExpression } from 'leaflet';

export function interpolatePosition(
  origin: City,
  destination: City,
  t: number
): [number, number] {
  const lat = origin.lat + (destination.lat - origin.lat) * t;
  const lng = origin.lng + (destination.lng - origin.lng) * t;
  return [lat, lng];
}

export function getBearing(origin: City, destination: City): number {
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  const lat1 = origin.lat * Math.PI / 180;
  const lat2 = destination.lat * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function getRouteBounds(origin: City, destination: City): LatLngBoundsExpression {
  const padding = 0.5;
  const minLat = Math.min(origin.lat, destination.lat) - padding;
  const maxLat = Math.max(origin.lat, destination.lat) + padding;
  const minLng = Math.min(origin.lng, destination.lng) - padding;
  const maxLng = Math.max(origin.lng, destination.lng) + padding;
  return [[minLat, minLng], [maxLat, maxLng]];
}

export function generateArcPoints(
  origin: City,
  destination: City,
  numPoints: number = 100,
  arcHeight: number = 0
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = origin.lat + (destination.lat - origin.lat) * t;
    const lng = origin.lng + (destination.lng - origin.lng) * t;

    // Add arc effect for flights
    const arc = arcHeight * Math.sin(t * Math.PI);
    points.push([lat + arc, lng]);
  }
  return points;
}
