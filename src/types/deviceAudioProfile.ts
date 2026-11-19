export interface DeviceAudioProfile {
  deviceId: string; // Endpoint sink ID or 'default'
  deviceLabel: string; // e.g. "Realtek High Definition Audio" or "Sony WH-1000XM4"
  normalizedLabel: string; // Normalized label for fallback matching across Chromium sessions
  groupId?: string;
  preferredVolume: number; // Remembered application volume (0.0 to 1.0)
  preferredSoundProfileId?: string; // Optional associated sound profile (e.g. 'bass_focus', 'late_night')
  isDefault: boolean;
  lastUsed: number;
  schemaVersion: number;
}
