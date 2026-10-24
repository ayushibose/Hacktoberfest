import { useEffect, useState, useSyncExternalStore } from 'react'
import { getTotals, initialState, reduceSession, remainingMs, restoreState, STORAGE_KEY } from '../lib/studySession'
import type { SessionAction, StudyState } from '../lib/studySession'
import type { SessionStatus } from '../types'

let snapshot: { state: StudyState; storageAvailable: boolean } | undefined
const listeners = new Set<() => void>()
function read() {
  if (!snapshot) {
    try { snapshot = { state: restoreState(localStorage.getItem(STORAGE_KEY)), storageAvailable: true } }
    catch { snapshot = { state: initialState(), storageAvailable: false } }
  }
  return snapshot
}
function emit() { listeners.forEach(listener => listener()) }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }

async function dispatch(action: SessionAction) {
  const commit = () => {
    const previous = read()
    let state = previous.state
    let storageAvailable = previous.storageAvailable
    if (storageAvailable) {
      try { state = restoreState(localStorage.getItem(STORAGE_KEY)) }
      catch { storageAvailable = false }
    }
    const next = reduceSession(state, action, Date.now())
    if (next !== state) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); storageAvailable = true }
      catch { storageAvailable = false }
    }
    if (JSON.stringify(next) !== JSON.stringify(previous.state) || storageAvailable !== previous.storageAvailable) {
      snapshot = { state: next, storageAvailable }; emit()
    }
  }
  // Serialize read/modify/write across tabs. A completion ID is recorded atomically with its history entry.
  try {
    if (navigator.locks) await navigator.locks.request(STORAGE_KEY, commit)
    else commit()
  } catch { commit() }
}

export function useStudySession() {
  const { state, storageAvailable } = useSyncExternalStore(subscribe, read)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => { setNow(Date.now()); void dispatch({ type: 'tick' }) }
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) { snapshot = undefined; emit(); tick() }
    }
    const timer = window.setInterval(tick, 250)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    void dispatch({ type: 'tick' })
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [])
  const status: SessionStatus = state.active?.status ?? (state.lastCompletedId ? 'completed' : 'idle')
  return { state, status, storageAvailable, remaining: status === 'completed' ? 0 : remainingMs(state, now),
    ...getTotals(state), dispatch, start: () => dispatch({ type: 'start', id: crypto.randomUUID() }) }
}
