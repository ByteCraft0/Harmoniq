import { TrackMetadata } from './audio';

export interface SavedQueue {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  tracks?: TrackMetadata[];
  currentIndex: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  dateCreated: number;
  dateModified: number;
}

export const DEFAULT_SAVED_QUEUES: Omit<SavedQueue, 'id' | 'dateCreated' | 'dateModified'>[] = [
  {
    name: 'Study Queue',
    description: 'Calm and focused tracks for work and study sessions',
    trackIds: [],
    currentIndex: 0,
    isShuffle: false,
    repeatMode: 'all',
  },
  {
    name: 'Night Drive',
    description: 'Atmospheric synths and deep rhythms for nighttime listening',
    trackIds: [],
    currentIndex: 0,
    isShuffle: false,
    repeatMode: 'all',
  },
  {
    name: 'Workout',
    description: 'High tempo, driving beats for energetic training sessions',
    trackIds: [],
    currentIndex: 0,
    isShuffle: false,
    repeatMode: 'off',
  },
  {
    name: 'Relaxation',
    description: 'Soothing acoustic, ambient and low-tempo harmonies',
    trackIds: [],
    currentIndex: 0,
    isShuffle: true,
    repeatMode: 'all',
  },
  {
    name: 'Weekend',
    description: 'Vibrant and uplifting tracks to enjoy the weekend',
    trackIds: [],
    currentIndex: 0,
    isShuffle: true,
    repeatMode: 'all',
  },
];
