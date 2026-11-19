export type AudioDeviceCategory =
  | 'headphones'
  | 'speakers'
  | 'dac'
  | 'bluetooth'
  | 'custom';

export type DeviceConnectionState =
  | 'active'
  | 'connected'
  | 'disconnected'
  | 'fallback';

export interface AudioRoutingProfile {
  id: string;
  name: string;
  category: AudioDeviceCategory;
  preferredDeviceId: string;
  preferredDeviceLabel: string;
  fallbackDeviceId: string; // default is 'default'
  listeningRoomId?: string | null;
  dateCreated: number;
  dateModified: number;
}

export interface ListeningRoom {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon identifier
  routingProfileId: string;
  volumeProfileId: string;
  dspPresetId?: string;
  isDefault?: boolean;
}

export const DEFAULT_LISTENING_ROOMS: ListeningRoom[] = [
  {
    id: 'room_living_room',
    name: 'Living Room (Hi-Fi)',
    description: 'Main speaker system with rich room acoustics',
    icon: 'Speaker',
    routingProfileId: 'profile_speakers',
    volumeProfileId: 'vol_daytime',
    dspPresetId: 'warm_room',
    isDefault: true,
  },
  {
    id: 'room_studio_desk',
    name: 'Studio Desk',
    description: 'Nearfield reference monitors for analytical listening',
    icon: 'Sliders',
    routingProfileId: 'profile_dac',
    volumeProfileId: 'vol_audiophile',
    dspPresetId: 'flat',
  },
  {
    id: 'room_bedside',
    name: 'Bedside / Late Night',
    description: 'Quiet headphone listening with relaxed volume ceiling',
    icon: 'Headphones',
    routingProfileId: 'profile_headphones',
    volumeProfileId: 'vol_late_night',
    dspPresetId: 'gentle_acoustic',
  },
  {
    id: 'room_commute',
    name: 'Commute / Mobile',
    description: 'Wireless Bluetooth headphones on the move',
    icon: 'Radio',
    routingProfileId: 'profile_bluetooth',
    volumeProfileId: 'vol_party',
    dspPresetId: 'bass_punch',
  },
];
