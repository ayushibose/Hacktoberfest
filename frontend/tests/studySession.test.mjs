import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTotals, initialState, isValidDuration, reduceSession, remainingMs, restoreState, settleSession } from '../src/lib/studySession.ts'
import { getMood, getProgression } from '../src/lib/ghostProgression.ts'

const startTime = Date.parse('2026-10-24T10:00:00Z')
const start = (duration = 25) => reduceSession({ ...initialState(), duration, goal: 'Read chapter 3' }, { type: 'start', id: 'session-1' }, startTime)

for (const duration of [5, 7, 15, 25, 45, 180]) test(`${duration} minutes awards exactly ${duration * 2} XP only at expiry`, () => {
  let state = start(duration)
  assert.equal(getTotals(state).xp, 0)
  assert.equal(settleSession(state, startTime + duration * 60_000 - 1), state)
  state = settleSession(state, startTime + duration * 60_000)
  assert.deepEqual(getTotals(state), { xp: duration * 2, minutes: duration, sessions: 1 })
  assert.equal(state.active, null)
  assert.equal(settleSession(state, startTime + 9_000_000), state)
  state = settleSession(restoreState(JSON.stringify(state)), startTime + 9_000_000)
  assert.equal(getTotals(state).xp, duration * 2)
})
test('pause freezes time, reload restores it, resume uses a new deadline', () => {
  let state = reduceSession(start(), { type: 'pause' }, startTime + 60_000)
  assert.equal(remainingMs(state, startTime + 600_000), 24 * 60_000)
  state = restoreState(JSON.stringify(state))
  assert.equal(state.active.status, 'paused')
  assert.equal(getTotals(settleSession(state, startTime + 10_000_000)).xp, 0)
  state = reduceSession(state, { type: 'resume' }, startTime + 600_000)
  assert.equal(state.active.expiresAt, startTime + 600_000 + 24 * 60_000)
  state = settleSession(state, state.active.expiresAt)
  assert.equal(getTotals(state).xp, 50)
})
test('background or closed tab completes by timestamp on reload', () => {
  const state = settleSession(restoreState(JSON.stringify(start())), startTime + 3_600_000)
  assert.equal(getTotals(state).xp, 50)
  assert.equal(state.history[0].completedAt, new Date(startTime + 25 * 60_000).toISOString())
})
test('cancel and double start cannot award or replace a running session', () => {
  let state = start()
  assert.equal(reduceSession(state, { type: 'start', id: 'duplicate' }, startTime + 100), state)
  state = reduceSession(state, { type: 'cancel' }, startTime + 1_000)
  state = settleSession(state, startTime + 9_000_000)
  assert.equal(getTotals(state).xp, 0)
})
test('malformed, outdated and invalid persisted records recover safely', () => {
  for (const raw of [null, '{', 'null', '42', '{"version":2}', '{"version":1,"history":[null,3]}']) {
    assert.deepEqual(restoreState(raw), initialState())
  }
  const state = start()
  assert.equal(restoreState(JSON.stringify({ ...state, active: { ...state.active, remainingMs: -2 } })).active, null)
  assert.equal(restoreState(JSON.stringify({ ...state, active: { ...state.active, expiresAt: 1 } })).active, null)
})
test('duplicate saved history and active completed IDs are discarded', () => {
  const running = start()
  const state = settleSession(running, startTime + 25 * 60_000)
  const restored = restoreState(JSON.stringify({ ...state, history: [...state.history, ...state.history], active: running.active }))
  assert.equal(restored.active, null)
  assert.equal(getTotals(restored).xp, 50)
})
test('goal stays editable during a session and duration stays fixed', () => {
  let state = start()
  state = reduceSession(state, { type: 'goal', value: 'New goal' }, startTime + 100)
  assert.equal(state.active.task, 'New goal')
  state = reduceSession(state, { type: 'duration', value: 45 }, startTime + 200)
  assert.equal(state.active.durationMinutes, 25)
})
test('evolution boundaries and independent mood mapping', () => {
  assert.deepEqual([0, 99, 100, 299, 300, 900].map(xp => getProgression(xp).stage), [1, 1, 2, 2, 3, 3])
  assert.equal(getProgression(300).next, null)
  assert.equal(getMood('running', 'unknown', 'not_checked', true), 'idle')
  assert.equal(getMood('running', 'facing', 'relevant', true), 'happy')
  assert.equal(getMood('running', 'away', 'unrelated', false), 'suspicious')
  assert.equal(getMood('running', 'away', 'unrelated', true), 'angry')
  assert.equal(getMood('paused', 'away', 'unrelated', true), 'idle')
  assert.equal(getMood('running', 'unknown', 'checking', true), 'idle')
})

test('invalid custom durations are rejected at the action and storage boundaries', () => {
  for (const value of [-1, 0, 4, 181, 5.5, NaN, Infinity, -Infinity, '', '7', null]) {
    assert.equal(isValidDuration(value), false)
    const state = initialState()
    assert.equal(reduceSession(state, { type: 'duration', value }, startTime), state)
    assert.equal(restoreState(JSON.stringify({ ...state, duration: value })).duration, 25)
  }
})

test('custom duration survives a paused reload and cannot change a running schedule', () => {
  let state = reduceSession(initialState(), { type: 'duration', value: 7, custom: true }, startTime)
  state = reduceSession(state, { type: 'start', id: 'custom' }, startTime)
  state = reduceSession(state, { type: 'pause' }, startTime + 100_000)
  state = restoreState(JSON.stringify(state))
  assert.equal(state.durationMode, 'custom')
  assert.equal(state.duration, 7)
  assert.equal(state.active.remainingMs, 320_000)
  assert.equal(reduceSession(state, { type: 'duration', value: 180 }, startTime + 110_000), state)
  state = reduceSession(state, { type: 'resume' }, startTime + 500_000)
  state = settleSession(state, startTime + 820_000)
  assert.equal(getTotals(state).xp, 14)
  assert.equal(restoreState(JSON.stringify(state)).history[0].durationMinutes, 7)
})

test('legacy v1 saves retain all XP, history, goals and active timer without task fields', () => {
  const completed = settleSession(start(), startTime + 25 * 60_000)
  const legacy = { version: 1, duration: 25, goal: 'Legacy goal', horror: true,
    history: completed.history, active: null, lastCompletedId: 'session-1' }
  const restored = restoreState(JSON.stringify(legacy))
  assert.deepEqual(getTotals(restored), { xp: 50, minutes: 25, sessions: 1 })
  assert.deepEqual(restored.history, completed.history)
  assert.equal(restored.goal, 'Legacy goal')
  assert.deepEqual(restored.tasks, [])
  const active = { ...legacy, active: { ...start().active, id: 'legacy-active' } }
  assert.equal(restoreState(JSON.stringify(active)).active.id, 'legacy-active')
})

test('task lifecycle persists and keeps the active goal authoritative', () => {
  let state = start()
  state = reduceSession(state, { type: 'task-add', id: 'task-1', title: '  Read notes  ' }, startTime)
  state = reduceSession(state, { type: 'task-add', id: 'task-2', title: 'Write code' }, startTime)
  state = reduceSession(state, { type: 'task-focus', id: 'task-1' }, startTime)
  assert.equal(state.goal, 'Read notes')
  assert.equal(state.active.task, state.goal)
  state = reduceSession(state, { type: 'task-edit', id: 'task-1', title: 'Read chapter 2' }, startTime)
  assert.equal(state.goal, 'Read chapter 2')
  assert.equal(state.active.task, state.goal)
  state = reduceSession(state, { type: 'task-toggle', id: 'task-1' }, startTime)
  state = restoreState(JSON.stringify(state))
  assert.equal(state.tasks[0].completed, true)
  assert.equal(state.selectedTaskId, 'task-1')
  assert.equal(getTotals(state).xp, 0)
  state = reduceSession(state, { type: 'task-focus', id: 'task-2' }, startTime)
  assert.equal(state.goal, 'Write code')
  state = reduceSession(state, { type: 'task-delete', id: 'task-2' }, startTime)
  assert.equal(state.tasks.length, 1)
  assert.equal(state.selectedTaskId, null)
  assert.equal(state.goal, 'Write code') // Retain the session's goal as manual text.
  assert.equal(state.active.task, state.goal)
})

test('manual goal detaches task selection; changing tasks does not rewrite completed history', () => {
  let state = settleSession(start(), startTime + 25 * 60_000)
  state = reduceSession(state, { type: 'task-add', id: 'task-1', title: 'Task' }, startTime + 25 * 60_000)
  state = reduceSession(state, { type: 'task-focus', id: 'task-1' }, startTime + 25 * 60_000)
  state = reduceSession(state, { type: 'goal', value: 'Manual goal' }, startTime + 25 * 60_000)
  assert.equal(state.selectedTaskId, null)
  assert.equal(state.tasks[0].title, 'Task')
  assert.equal(state.history[0].task, 'Read chapter 3')
  assert.equal(getTotals(state).xp, 50)
})

test('empty tasks, duplicate IDs, unknown drops and malformed saved tasks are ignored', () => {
  let state = initialState()
  assert.equal(reduceSession(state, { type: 'task-add', id: 'x', title: '  ' }, startTime), state)
  assert.equal(reduceSession(state, { type: 'task-focus', id: 'not-a-task' }, startTime), state)
  state = reduceSession(state, { type: 'task-add', id: 'x', title: 'Valid' }, startTime)
  assert.equal(reduceSession(state, { type: 'task-add', id: 'x', title: 'Duplicate' }, startTime), state)
  assert.equal(reduceSession(state, { type: 'task-edit', id: 'x', title: '  ' }, startTime), state)
  const restored = restoreState(JSON.stringify({ ...state, tasks: [...state.tasks, ...state.tasks, null, { id: 'bad', title: '' }], selectedTaskId: 'missing' }))
  assert.equal(restored.tasks.length, 1)
  assert.equal(restored.selectedTaskId, null)
})
