import { TrackMetadata } from './audio';

export type ABXStreamChoice = 'A' | 'B' | 'X';

export interface ABXTrial {
  trialIndex: number; // 0-based
  secretAssignment: 'A' | 'B'; // Which stream X secretly is
  userChoice: 'A' | 'B' | null;
  isCorrect: boolean | null;
  timestamp: number;
  timeSpentAuditioningSec: number;
}

export interface ABXSession {
  id: string;
  name: string;
  trackA: TrackMetadata | null;
  trackB: TrackMetadata | null;
  trackAName: string;
  trackBName: string;
  totalTrials: number;
  currentTrialIndex: number;
  trials: ABXTrial[];
  levelTrimDbA: number;
  levelTrimDbB: number;
  isAutoLevelMatched: boolean;
  isComplete: boolean;
  correctCount: number;
  completedTrialsCount: number;
  correctPercentage: number;
  pValue: number; // Binomial p-value (e.g. < 0.05 is statistically significant)
  isStatisticallySignificant: boolean;
  confidenceRating: string; // e.g. "99.9% (Highly Significant)", "Not Significant (Random Chance)"
  dateCreated: number;
  dateCompleted?: number;
  notes?: string;
  audioGearNotes?: string; // e.g. "Sennheiser HD600 + Schiit Magni"
}

export interface ABXStatisticalResult {
  trials: number;
  correct: number;
  percentage: number;
  pValue: number;
  isSignificant: boolean;
  interpretation: string;
}
