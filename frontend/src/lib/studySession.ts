import type { FocusDuration, StudySession, TodoTask } from '../types/index.ts'

export const STORAGE_KEY = 'ghostmode:v1'
export const DURATIONS: FocusDuration[] = [15, 25, 45]
export const MIN_DURATION = 5
export const MAX_DURATION = 180
export const TASK_DRAG_TYPE = 'application/x-ghostmode-task'
export const isValidDuration = (value: unknown): value is FocusDuration =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_DURATION && value <= MAX_DURATION
export interface CompletedSession extends StudySession { completed: true; completedAt: string }
export interface ActiveSession {
  id: string; task: string; durationMinutes: FocusDuration; startedAt: string
  status: 'running' | 'paused'; remainingMs: number; expiresAt: number | null
}
// History is the source of truth for totals: all changes are saved in one record.
export interface StudyState {
  version: 1; duration: FocusDuration; goal: string; horror: boolean
  history: CompletedSession[]; active: ActiveSession | null; lastCompletedId: string | null
  durationMode: 'preset' | 'custom'; tasks: TodoTask[]; selectedTaskId: string | null
}
export const initialState = (): StudyState => ({ version: 1, duration: 25, durationMode: 'preset', goal: '', horror: false,
  history: [], active: null, lastCompletedId: null, tasks: [], selectedTaskId: null })
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 200

export function restoreState(raw: string | null): StudyState {
  const state = initialState()
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!record(value) || value.version !== 1) return state
    if (isValidDuration(value.duration)) state.duration = value.duration
    state.durationMode = value.durationMode === 'custom' || !DURATIONS.includes(state.duration) ? 'custom' : 'preset'
    if (typeof value.goal === 'string') state.goal = value.goal.slice(0, 200)
    state.horror = value.horror === true
    const seen = new Set<string>()
    if (Array.isArray(value.history)) for (const item of value.history) {
      if (!record(item) || !id(item.id) || seen.has(item.id) || !isValidDuration(item.durationMinutes) ||
        item.completed !== true || typeof item.task !== 'string' || !date(item.startedAt) || !date(item.completedAt) ||
        Date.parse(item.completedAt) - Date.parse(item.startedAt) < item.durationMinutes * 60_000) continue
      seen.add(item.id)
      state.history.push({ id: item.id, task: item.task.slice(0, 200), durationMinutes: item.durationMinutes,
        completed: true, startedAt: item.startedAt, completedAt: item.completedAt })
    }
    const active = value.active
    if (record(active) && id(active.id) && !seen.has(active.id) && isValidDuration(active.durationMinutes) &&
      typeof active.task === 'string' && date(active.startedAt) && typeof active.remainingMs === 'number' &&
      Number.isFinite(active.remainingMs) && active.remainingMs > 0 && active.remainingMs <= active.durationMinutes * 60_000 &&
      ((active.status === 'paused' && active.expiresAt === null) || (active.status === 'running' &&
        typeof active.expiresAt === 'number' && Number.isFinite(active.expiresAt) &&
        active.expiresAt >= Date.parse(active.startedAt) + active.durationMinutes * 60_000))) {
      state.active = { id: active.id, task: active.task.slice(0, 200), durationMinutes: active.durationMinutes,
        startedAt: active.startedAt, status: active.status, remainingMs: active.remainingMs, expiresAt: active.expiresAt as number | null }
    }
    if (typeof value.lastCompletedId === 'string' && seen.has(value.lastCompletedId)) state.lastCompletedId = value.lastCompletedId
    const taskIds = new Set<string>()
    if (Array.isArray(value.tasks)) for (const task of value.tasks) {
      if (!record(task) || !id(task.id) || taskIds.has(task.id) || typeof task.title !== 'string' ||
        !task.title.trim() || typeof task.completed !== 'boolean' || !date(task.createdAt)) continue
      taskIds.add(task.id)
      state.tasks.push({ id: task.id, title: task.title.trim().slice(0, 200), completed: task.completed, createdAt: task.createdAt })
    }
    const selected = state.tasks.find(task => task.id === value.selectedTaskId)
    if (selected) {
      state.selectedTaskId = selected.id
      state.goal = selected.title
      if (state.active) state.active.task = selected.title
    }
    return state
  } catch { return state }
}

export function remainingMs(state: StudyState, now: number) {
  return state.active ? state.active.status === 'running'
    ? Math.max(0, state.active.expiresAt! - now) : state.active.remainingMs : state.duration * 60_000
}

export function settleSession(state: StudyState, now: number): StudyState {
  const active = state.active
  if (!active || active.status !== 'running' || active.expiresAt! > now) return state
  const entry: CompletedSession = { id: active.id, task: active.task, durationMinutes: active.durationMinutes,
    startedAt: active.startedAt, completed: true, completedAt: new Date(active.expiresAt!).toISOString() }
  return { ...state, active: null, lastCompletedId: active.id,
    history: state.history.some(item => item.id === active.id) ? state.history : [...state.history, entry] }
}

export type SessionAction = { type: 'tick' | 'pause' | 'resume' | 'cancel' } |
  { type: 'start'; id: string } | { type: 'duration'; value: FocusDuration; custom?: boolean } |
  { type: 'goal'; value: string } | { type: 'horror'; value: boolean } |
  { type: 'task-add'; id: string; title: string } | { type: 'task-edit'; id: string; title: string } |
  { type: 'task-delete' | 'task-toggle' | 'task-focus'; id: string }

export function reduceSession(input: StudyState, action: SessionAction, now: number): StudyState {
  const state = settleSession(input, now)
  const active = state.active
  switch (action.type) {
    case 'start': return active ? state : { ...state, lastCompletedId: null, active: {
      id: action.id, task: state.goal.trim(), durationMinutes: state.duration, startedAt: new Date(now).toISOString(),
      status: 'running', remainingMs: state.duration * 60_000, expiresAt: now + state.duration * 60_000 } }
    case 'pause': return active?.status === 'running' ? { ...state, active: { ...active, status: 'paused', remainingMs: remainingMs(state, now), expiresAt: null } } : state
    case 'resume': return active?.status === 'paused' ? { ...state, active: { ...active, status: 'running', expiresAt: now + active.remainingMs } } : state
    case 'cancel': return active || state.lastCompletedId ? { ...state, active: null, lastCompletedId: null } : state
    case 'duration': return active || !isValidDuration(action.value) ? state : { ...state, duration: action.value,
      durationMode: action.custom || !DURATIONS.includes(action.value) ? 'custom' : 'preset', lastCompletedId: null }
    // Manual entry deliberately detaches the task, so there is only one authoritative goal.
    case 'goal': return { ...state, selectedTaskId: null, goal: action.value.slice(0, 200), active: active ? { ...active, task: action.value.slice(0, 200) } : null }
    case 'horror': return { ...state, horror: action.value }
    case 'task-add': {
      const title = action.title.trim().slice(0, 200)
      if (!title || !id(action.id) || state.tasks.some(task => task.id === action.id)) return state
      return { ...state, tasks: [...state.tasks, { id: action.id, title, completed: false, createdAt: new Date(now).toISOString() }] }
    }
    case 'task-edit': {
      const title = action.title.trim().slice(0, 200)
      if (!title || !state.tasks.some(task => task.id === action.id)) return state
      return { ...state, tasks: state.tasks.map(task => task.id === action.id ? { ...task, title } : task),
        ...(state.selectedTaskId === action.id ? { goal: title, active: active ? { ...active, task: title } : null } : {}) }
    }
    case 'task-delete': return { ...state, tasks: state.tasks.filter(task => task.id !== action.id),
      selectedTaskId: state.selectedTaskId === action.id ? null : state.selectedTaskId }
    case 'task-toggle': return { ...state, tasks: state.tasks.map(task => task.id === action.id ? { ...task, completed: !task.completed } : task) }
    case 'task-focus': {
      const task = state.tasks.find(task => task.id === action.id)
      return task ? { ...state, selectedTaskId: task.id, goal: task.title, active: active ? { ...active, task: task.title } : null } : state
    }
    default: return state
  }
}

export function getTotals(state: StudyState) {
  const minutes = state.history.reduce((sum, item) => sum + item.durationMinutes, 0)
  return { minutes, xp: minutes * 2, sessions: state.history.length }
}
