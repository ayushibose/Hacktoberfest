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