export type ShortcutAction =
  | 'playPause'
  | 'nextTrack'
  | 'prevTrack'
  | 'volumeUp'
  | 'volumeDown'
  | 'toggleMute'
  | 'toggleWindow';

export interface ShortcutDefinition {
  id: ShortcutAction;
  label: string;
  description: string;
  defaultKey: string;
}

export type ShortcutConfig = Record<ShortcutAction, string>;

export interface ShortcutStatus {
  registered: boolean;
  error?: string;
}

export interface ShortcutStateResponse {
  shortcuts: ShortcutConfig;
  status: Record<ShortcutAction, ShortcutStatus>;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'playPause',
    label: 'Play / Pause',
    description: 'Toggle playback of the current audio track',
    defaultKey: 'CommandOrControl+Alt+Space',
  },
  {
    id: 'nextTrack',
    label: 'Next Track',
    description: 'Skip to the next song in the active queue',
    defaultKey: 'CommandOrControl+Alt+Right',
  },
  {
    id: 'prevTrack',
    label: 'Previous Track',
    description: 'Return to previous song or track beginning',
    defaultKey: 'CommandOrControl+Alt+Left',
  },
  {
    id: 'volumeUp',
    label: 'Volume Up',
    description: 'Increase master audio output volume by 5%',
    defaultKey: 'CommandOrControl+Alt+Up',
  },
  {
    id: 'volumeDown',
    label: 'Volume Down',
    description: 'Decrease master audio output volume by 5%',
    defaultKey: 'CommandOrControl+Alt+Down',
  },
  {
    id: 'toggleMute',
    label: 'Mute / Unmute',
    description: 'Toggle audio output mute state',
    defaultKey: 'CommandOrControl+Alt+M',
  },
  {
    id: 'toggleWindow',
    label: 'Show / Hide Harmoniq',
    description: 'Toggle Harmoniq between minimized/tray and active view',
    defaultKey: 'CommandOrControl+Alt+H',
  },
];

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  playPause: 'CommandOrControl+Alt+Space',
  nextTrack: 'CommandOrControl+Alt+Right',
  prevTrack: 'CommandOrControl+Alt+Left',
  volumeUp: 'CommandOrControl+Alt+Up',
  volumeDown: 'CommandOrControl+Alt+Down',
  toggleMute: 'CommandOrControl+Alt+M',
  toggleWindow: 'CommandOrControl+Alt+H',
};
