import type { TransportMode } from '../types/travel';

interface TransportConfig {
  label: string;
  emoji: string;
  color: string;
  speed: string;
}

export const TRANSPORT_CONFIG: Record<TransportMode, TransportConfig> = {
  flight: {
    label: 'Flight',
    emoji: '\u2708\uFE0F',
    color: '#3B82F6',
    speed: '~550 mph',
  },
  car: {
    label: 'Car',
    emoji: '\uD83D\uDE97',
    color: '#EF4444',
    speed: '~65 mph',
  },
  bus: {
    label: 'Bus',
    emoji: '\uD83D\uDE8C',
    color: '#F59E0B',
    speed: '~55 mph',
  },
  amtrak: {
    label: 'Amtrak',
    emoji: '\uD83D\uDE82',
    color: '#10B981',
    speed: '~80 mph',
  },
  rv: {
    label: 'RV',
    emoji: '\uD83D\uDE90',
    color: '#8B5CF6',
    speed: '~55 mph',
  },
};

// 24x24 Material-style glyphs; also drawn directly onto canvas via Path2D.
export const TRANSPORT_ICON_PATHS: Record<TransportMode, string> = {
  flight: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  car: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
  bus: 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z',
  amtrak: 'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  rv: 'M18 4H6c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h1c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h1V9l-4-5zm-8 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17 9h-2V6h1.5L17 9z',
};

export function getTransportSvgIcon(mode: TransportMode, size: number = 40): string {
  const config = TRANSPORT_CONFIG[mode];
  return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${config.color}">
        <path d="${TRANSPORT_ICON_PATHS[mode]}"/>
      </svg>`;
}
