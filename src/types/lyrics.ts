export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  plainText?: string;
  source: 'embedded' | 'lrc_file' | 'online' | 'none';
  offset: number; // in seconds (e.g. +0.5s or -0.3s)
}
