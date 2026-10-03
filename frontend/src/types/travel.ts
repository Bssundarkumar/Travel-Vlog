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

/** One stop of a multi-stop trip video: a place, and the photo shown there. */
export interface TripStop {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  photo: Blob | null;
  photoUrl: string | null;
  takenAt: Date | null;
}

export type VideoFormat = 'portrait' | 'landscape';
