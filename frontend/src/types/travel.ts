export type TransportMode = 'flight' | 'car' | 'bus' | 'amtrak' | 'rv';

export interface City {
  name: string;
  lat: number;
  lng: number;
}

export interface TravelRoute {
  origin: City;
  destination: City;
  transport: TransportMode;
  photos: File[];
}

export interface AnimationState {
  isPlaying: boolean;
  isRecording: boolean;
  progress: number;
  phase: 'idle' | 'zoom-out' | 'travel' | 'zoom-in' | 'photos' | 'done';
}
