export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault: boolean;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}
