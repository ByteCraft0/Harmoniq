import {
  AudioRoutingProfile,
  ListeningRoom,
  DeviceConnectionState,
  DEFAULT_LISTENING_ROOMS,
} from '../types/audioRouting';
import { AudioDeviceInfo } from '../types/devices';
import { audioEngine } from './audioEngine';

const STORAGE_ROUTING_PROFILES_KEY = 'harmoniq_audio_routing_profiles_v1';
const STORAGE_LISTENING_ROOMS_KEY = 'harmoniq_listening_rooms_v1';
const STORAGE_ACTIVE_PROFILE_KEY = 'harmoniq_active_routing_profile_id_v1';
const STORAGE_ACTIVE_ROOM_KEY = 'harmoniq_active_listening_room_id_v1';

export const DEFAULT_ROUTING_PROFILES: AudioRoutingProfile[] = [
  {
    id: 'profile_headphones',
    name: 'Headphones',
    category: 'headphones',
    preferredDeviceId: 'default',
    preferredDeviceLabel: 'Default Headphones / Headset',
    fallbackDeviceId: 'default',
    listeningRoomId: 'room_bedside',
    dateCreated: Date.now(),
    dateModified: Date.now(),
  },
  {
    id: 'profile_speakers',
    name: 'Speakers',
    category: 'speakers',
    preferredDeviceId: 'default',
    preferredDeviceLabel: 'System Stereo Speakers',
    fallbackDeviceId: 'default',
    listeningRoomId: 'room_living_room',
    dateCreated: Date.now(),
    dateModified: Date.now(),
  },
  {
    id: 'profile_dac',
    name: 'External DAC',
    category: 'dac',
    preferredDeviceId: 'default',
    preferredDeviceLabel: 'USB Audio DAC / Interface',
    fallbackDeviceId: 'default',
    listeningRoomId: 'room_studio_desk',
    dateCreated: Date.now(),
    dateModified: Date.now(),
  },
  {
    id: 'profile_bluetooth',
    name: 'Bluetooth Audio',
    category: 'bluetooth',
    preferredDeviceId: 'default',
    preferredDeviceLabel: 'Bluetooth Wireless Endpoint',
    fallbackDeviceId: 'default',
    listeningRoomId: 'room_commute',
    dateCreated: Date.now(),
    dateModified: Date.now(),
  },
  {
    id: 'profile_custom',
    name: 'Custom Output',
    category: 'custom',
    preferredDeviceId: 'default',
    preferredDeviceLabel: 'Custom Endpoint',
    fallbackDeviceId: 'default',
    dateCreated: Date.now(),
    dateModified: Date.now(),
  },
];

export class AudioRoutingService {
  private profiles: Map<string, AudioRoutingProfile> = new Map();
  private rooms: Map<string, ListeningRoom> = new Map();
  private activeProfileId: string = DEFAULT_ROUTING_PROFILES[0].id;
  private activeRoomId: string = DEFAULT_LISTENING_ROOMS[0].id;

  private availableDevices: AudioDeviceInfo[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
    this.initDeviceWatcher();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawProfiles = localStorage.getItem(STORAGE_ROUTING_PROFILES_KEY);
        if (rawProfiles) {
          const parsed = JSON.parse(rawProfiles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const p of parsed) {
              if (p && p.id) this.profiles.set(p.id, p);
            }
          }
        }

        const rawRooms = localStorage.getItem(STORAGE_LISTENING_ROOMS_KEY);
        if (rawRooms) {
          const parsed = JSON.parse(rawRooms);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const r of parsed) {
              if (r && r.id) this.rooms.set(r.id, r);
            }
          }
        }

        const savedActiveProfile = localStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY);
        if (savedActiveProfile && this.profiles.has(savedActiveProfile)) {
          this.activeProfileId = savedActiveProfile;
        }

        const savedActiveRoom = localStorage.getItem(STORAGE_ACTIVE_ROOM_KEY);
        if (savedActiveRoom && this.rooms.has(savedActiveRoom)) {
          this.activeRoomId = savedActiveRoom;
        }
      }
    } catch (e) {
      console.warn('Failed to load routing profiles:', e);
    }

    // Seed defaults if empty
    if (this.profiles.size === 0) {
      for (const p of DEFAULT_ROUTING_PROFILES) {
        this.profiles.set(p.id, p);
      }
      this.activeProfileId = DEFAULT_ROUTING_PROFILES[0].id;
    }

    if (this.rooms.size === 0) {
      for (const r of DEFAULT_LISTENING_ROOMS) {
        this.rooms.set(r.id, r);
      }
      this.activeRoomId = DEFAULT_LISTENING_ROOMS[0].id;
    }
  }

  private save(): void {
    try {
      const pList = Array.from(this.profiles.values());
      const rList = Array.from(this.rooms.values());

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_ROUTING_PROFILES_KEY, JSON.stringify(pList));
        localStorage.setItem(STORAGE_LISTENING_ROOMS_KEY, JSON.stringify(rList));
        localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, this.activeProfileId);
        localStorage.setItem(STORAGE_ACTIVE_ROOM_KEY, this.activeRoomId);
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_ROUTING_PROFILES_KEY, pList).catch(() => {});
        (window as any).harmoniqApi.savePersistentData(STORAGE_LISTENING_ROOMS_KEY, rList).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist routing profiles:', e);
    }
    this.emit();
  }

  private initDeviceWatcher(): void {
    audioEngine.subscribeDeviceChange((_, devices) => {
      this.availableDevices = devices;
      this.verifyActiveDevice();
    });

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const devices = await audioEngine.getAvailableOutputDevices();
        this.availableDevices = devices;
        this.verifyActiveDevice();
      });
    }
  }

  /**
   * Evaluates the connection state of a profile's preferred device
   */
  public getProfileConnectionState(profile: AudioRoutingProfile): DeviceConnectionState {
    if (!profile.preferredDeviceId || profile.preferredDeviceId === 'default') {
      return 'connected';
    }

    const found = this.availableDevices.some(
      (d) => d.deviceId === profile.preferredDeviceId || (profile.preferredDeviceLabel && d.label === profile.preferredDeviceLabel)
    );

    if (found) {
      return profile.id === this.activeProfileId ? 'active' : 'connected';
    }

    return 'disconnected';
  }

  /**
   * Automatic recovery when active device disconnects
   */
  private async verifyActiveDevice(): Promise<void> {
    const profile = this.getActiveProfile();
    if (!profile) return;

    const state = this.getProfileConnectionState(profile);
    if (state === 'disconnected') {
      // Preferred device is gone: gracefully fall back to fallback endpoint
      const fallbackId = profile.fallbackDeviceId || 'default';
      console.warn(`Preferred device "${profile.preferredDeviceLabel}" disconnected. Falling back to "${fallbackId}".`);
      await audioEngine.setOutputDevice(fallbackId);
      this.emit();
    }
  }

  // --- Profile Operations ---

  public getProfiles(): AudioRoutingProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfile(id: string): AudioRoutingProfile | undefined {
    return this.profiles.get(id);
  }

  public getActiveProfile(): AudioRoutingProfile {
    return this.profiles.get(this.activeProfileId) || DEFAULT_ROUTING_PROFILES[0];
  }

  public async setActiveProfile(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    this.activeProfileId = profileId;

    // Check device availability
    const connectionState = this.getProfileConnectionState(profile);
    const targetDeviceId = connectionState === 'disconnected' ? profile.fallbackDeviceId || 'default' : profile.preferredDeviceId;

    await audioEngine.setOutputDevice(targetDeviceId);

    // If profile is associated with a listening room, also update active room
    if (profile.listeningRoomId && this.rooms.has(profile.listeningRoomId)) {
      this.activeRoomId = profile.listeningRoomId;
    }

    this.save();
    return true;
  }

  public createProfile(
    name: string,
    category: AudioRoutingProfile['category'],
    preferredDeviceId = 'default',
    preferredDeviceLabel = 'Default Audio Endpoint',
    listeningRoomId: string | null = null
  ): AudioRoutingProfile {
    const id = `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const newProfile: AudioRoutingProfile = {
      id,
      name: name.trim() || 'New Output Profile',
      category,
      preferredDeviceId,
      preferredDeviceLabel,
      fallbackDeviceId: 'default',
      listeningRoomId,
      dateCreated: now,
      dateModified: now,
    };
    this.profiles.set(id, newProfile);
    this.save();
    return newProfile;
  }

  public updateProfile(
    id: string,
    updates: Partial<Omit<AudioRoutingProfile, 'id' | 'dateCreated'>>
  ): boolean {
    const p = this.profiles.get(id);
    if (!p) return false;

    if (updates.name !== undefined) p.name = updates.name.trim() || p.name;
    if (updates.category !== undefined) p.category = updates.category;
    if (updates.preferredDeviceId !== undefined) p.preferredDeviceId = updates.preferredDeviceId;
    if (updates.preferredDeviceLabel !== undefined) p.preferredDeviceLabel = updates.preferredDeviceLabel;
    if (updates.fallbackDeviceId !== undefined) p.fallbackDeviceId = updates.fallbackDeviceId;
    if (updates.listeningRoomId !== undefined) p.listeningRoomId = updates.listeningRoomId;
    p.dateModified = Date.now();

    if (this.activeProfileId === id) {
      this.verifyActiveDevice();
    }

    this.save();
    return true;
  }

  public deleteProfile(id: string): boolean {
    if (!this.profiles.has(id)) return false;
    // Don't delete if it's the only profile
    if (this.profiles.size <= 1) return false;

    this.profiles.delete(id);
    if (this.activeProfileId === id) {
      this.activeProfileId = Array.from(this.profiles.keys())[0];
      this.setActiveProfile(this.activeProfileId);
    }
    this.save();
    return true;
  }

  // --- Listening Rooms ---

  public getRooms(): ListeningRoom[] {
    return Array.from(this.rooms.values());
  }

  public getActiveRoom(): ListeningRoom {
    return this.rooms.get(this.activeRoomId) || DEFAULT_LISTENING_ROOMS[0];
  }

  public async setActiveRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    this.activeRoomId = roomId;

    // Apply associated routing profile
    if (room.routingProfileId && this.profiles.has(room.routingProfileId)) {
      await this.setActiveProfile(room.routingProfileId);
    }

    this.save();
    return true;
  }

  public updateRoom(id: string, updates: Partial<ListeningRoom>): boolean {
    const r = this.rooms.get(id);
    if (!r) return false;
    Object.assign(r, updates);
    this.save();
    return true;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    cb();
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const audioRoutingService = new AudioRoutingService();
