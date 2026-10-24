export interface StudySession {
  id: string;
  task: string;
  durationMinutes: number;
  completed: boolean;
  startedAt: string;
}

export interface Ghost {
  name: string;
  xp: number;
  level: number;
  evolutionStage: number;
}

export type FocusStatus =
  | "focused"
  | "looking-away"
  | "away"
  | "camera-off";

export type AttentionStatus = 'facing' | 'away' | 'unknown';
export type ScreenStatus = 'relevant' | 'unrelated' | 'uncertain' | 'not_checked' | 'checking';
export type GhostMood = 'idle' | 'happy' | 'suspicious' | 'angry' | 'possessed' | 'celebrating';
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed';
export type EvolutionStage = 1 | 2 | 3;
/** Whole minutes, validated at the storage/action boundary (5–180). */
export type FocusDuration = number;

export interface TodoTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}
