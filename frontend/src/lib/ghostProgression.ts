import type { AttentionStatus, EvolutionStage, GhostMood, ScreenStatus, SessionStatus } from '../types/index.ts'

export function getProgression(xp: number) {
  const stage: EvolutionStage = xp >= 300 ? 3 : xp >= 100 ? 2 : 1
  const floor = stage === 3 ? 300 : stage === 2 ? 100 : 0
  const next = stage === 3 ? null : stage === 2 ? 300 : 100
  return { stage, name: ['Wisp', 'Haunted', 'Possessed'][stage - 1], next,
    progress: next === null ? 100 : Math.min(100, (xp - floor) / (next - floor) * 100) }
}

export function getMood(session: SessionStatus, attention: AttentionStatus, screen: ScreenStatus, horror: boolean): GhostMood {
  if (session !== 'running') return 'idle'
  if (attention === 'away' && screen === 'unrelated') return horror ? 'angry' : 'suspicious'
  if (attention === 'away' || screen === 'unrelated') return 'suspicious'
  if (attention === 'facing' && screen === 'relevant') return 'happy'
  return 'idle'
}
