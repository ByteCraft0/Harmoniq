export interface MusicBookmark {
  id: string;
  trackId: string;
  title: string;
  note?: string;
  timestamp: number; // in seconds
  dateCreated: number;
}
