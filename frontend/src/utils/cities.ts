import type { City } from '../types/travel';

export const POPULAR_CITIES: City[] = [
  { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio, TX', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas, TX', lat: 32.7767, lng: -96.7970 },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
  { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Washington, DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
  { name: 'Orlando, FL', lat: 28.5383, lng: -81.3792 },
  { name: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
  { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 },
  { name: 'Portland, OR', lat: 45.5152, lng: -122.6784 },
  { name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
  { name: 'Charlotte, NC', lat: 35.2271, lng: -80.8431 },
  { name: 'Richmond, VA', lat: 37.5407, lng: -77.4360 },
  { name: 'Virginia Beach, VA', lat: 36.8529, lng: -75.9780 },
  { name: 'Norfolk, VA', lat: 36.8508, lng: -76.2859 },
  { name: 'Tampa, FL', lat: 27.9506, lng: -82.4572 },
  { name: 'Minneapolis, MN', lat: 44.9778, lng: -93.2650 },
  { name: 'New Orleans, LA', lat: 29.9511, lng: -90.0715 },
  { name: 'Salt Lake City, UT', lat: 40.7608, lng: -111.8910 },
  { name: 'Honolulu, HI', lat: 21.3069, lng: -157.8583 },
];

export function searchCities(query: string): City[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return POPULAR_CITIES.filter(c => c.name.toLowerCase().includes(lower));
}

export function getDistance(a: City, b: City): number {
  const R = 3959; // Earth radius in miles
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal = sinDLat * sinDLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}
