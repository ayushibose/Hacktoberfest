import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStudySession } from '../hooks/useStudySession'
import { getMood, getProgression } from '../lib/ghostProgression'
import type { AttentionStatus, EvolutionStage, GhostMood, ScreenStatus, SessionStatus } from '../types'
import { StudyTimer } from './StudyTimer'
import { TaskList } from './TaskList'
import { CrawlingSpider, Spiderweb } from './HalloweenDecor'
import FocusMonitor from './FocusMonitor'
import JumpScare from './JumpScare'
import { useScreenCapture, type ScreenAnalysis } from '../hooks/useScreenCapture'
import { formatDuration, formatXp } from '../lib/studySession'
const GhostPet = lazy(() => import('./GhostPet'))

export interface DashboardProps {
  attentionStatus?: AttentionStatus
  /** Distinguishes an unavailable camera from an unknown reading. */
  attentionConnected?: boolean
  screenStatus?: ScreenStatus
  focusMonitor?: ReactNode
  screenMonitor?: ReactNode
  onGoalChange?: (goal: string) => void
  onMoodChange?: (mood: GhostMood) => void
  onHorrorChange?: (enabled: boolean) => void
  onSessionStatusChange?: (status: SessionStatus) => void
}
const moodCopy: Record<GhostMood, string> = {
  idle: 'Morrow is waiting for a focus session.', happy: 'Morrow is happy. Keep it up.', suspicious: 'Morrow is getting suspicious.',
  angry: 'Morrow is angry. Back to your task.', possessed: 'Morrow has lost their composure.', celebrating: 'Session complete. Morrow approves.',
}
const moods: GhostMood[] = ['idle', 'happy', 'suspicious', 'angry', 'possessed', 'celebrating']

export function Dashboard({ attentionStatus: suppliedAttention, attentionConnected, screenStatus: suppliedScreen, focusMonitor, screenMonitor, onGoalChange, onMoodChange, onHorrorChange, onSessionStatusChange }: DashboardProps) {
  const session = useStudySession()
  const { state, status, xp, minutes, sessions } = session
  const [liveAttention, setLiveAttention] = useState<AttentionStatus>('unknown')
  const [liveCameraConnected, setLiveCameraConnected] = useState(false)
  const [screenDistraction, setScreenDistraction] = useState(false)
  const handleScreenAnalysis = useCallback((analysis: ScreenAnalysis) => {
    if (analysis.relevance === 'unrelated') setScreenDistraction(true)
  }, [])
  const screen = useScreenCapture({ goal: state.goal, enabled: status === 'running', onAnalysis: handleScreenAnalysis })
  useEffect(() => {
    if (status !== 'running' || !state.horror) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreenDistraction(false)
    }
  }, [state.horror, status])
  const attentionStatus = suppliedAttention ?? liveAttention
  const screenStatus: ScreenStatus = suppliedScreen ?? (screen.isAnalysing ? 'checking' : screen.isSharing ? screen.analysis?.relevance ?? 'not_checked' : 'not_checked')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  async function startFocus() {
    if (startingRef.current) return
    startingRef.current = true
    setStarting(true)
    // Browser screen permission needs the original click's user activation.
    void screen.startSharing()
    try {
      if (status === 'paused') await session.dispatch({ type: 'resume' })
      else await session.start()
      if (state.duration === 0) screen.stopSharing()
    } finally { startingRef.current = false; setStarting(false) }
  }
  const evolution = getProgression(xp)
  const [demo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1')
  const [previewMood, setPreviewMood] = useState<GhostMood>('idle')
  const [previewStage, setPreviewStage] = useState<EvolutionStage>(1)
  const [celebrating, setCelebrating] = useState(false)
  const [reaction, setReaction] = useState(0)
  const [demoCelebration, setDemoCelebration] = useState(0)
  const [draggingTask, setDraggingTask] = useState<string | null>(null)
  const [focusNotice, setFocusNotice] = useState('')
  const [xpEffect, setXpEffect] = useState(false)
  const [evolved, setEvolved] = useState(false)
  const previousXp = useRef(xp)
  useEffect(() => {
    if (xp <= previousXp.current) { previousXp.current = xp; return }
    const changedStage = getProgression(previousXp.current).stage !== evolution.stage
    previousXp.current = xp
    const start = window.setTimeout(() => { setXpEffect(true); setEvolved(changedStage) }, 0)
    const finish = window.setTimeout(() => { setXpEffect(false); setEvolved(false) }, 4200)
    return () => { clearTimeout(start); clearTimeout(finish) }
  }, [xp, evolution.stage])
  useEffect(() => {
    if (!focusNotice) return
    const timeout = window.setTimeout(() => setFocusNotice(''), 3500)
    return () => clearTimeout(timeout)
  }, [focusNotice])
  async function focusTask(id: string) {
    const task = state.tasks.find(item => item.id === id)
    if (!task) return
    await session.dispatch({ type: 'task-focus', id })
    setDraggingTask(null)
    setFocusNotice(`Selected: ${task.title}`)
  }
  const lastCompleted = useRef(state.lastCompletedId)
  useEffect(() => {
    if (!state.lastCompletedId) {
      const reset = window.setTimeout(() => setCelebrating(false), 0)
      return () => clearTimeout(reset)
    }
    if (state.lastCompletedId === lastCompleted.current) return
    lastCompleted.current = state.lastCompletedId
    const start = window.setTimeout(() => setCelebrating(true), 0)
    const finish = window.setTimeout(() => setCelebrating(false), 4200)
    return () => { clearTimeout(start); clearTimeout(finish) }
  }, [state.lastCompletedId])
  useEffect(() => {
    if (!demoCelebration) return
    const start = window.setTimeout(() => setCelebrating(true), 0)
    const finish = window.setTimeout(() => setCelebrating(false), 4200)
    return () => { clearTimeout(start); clearTimeout(finish) }
  }, [demoCelebration])
  const mood = celebrating ? 'celebrating' : demo ? previewMood : getMood(status, attentionStatus, screenStatus, state.horror)
  useEffect(() => { onGoalChange?.(state.goal) }, [state.goal, onGoalChange])
  useEffect(() => { onMoodChange?.(mood) }, [mood, onMoodChange])
  useEffect(() => { onHorrorChange?.(state.horror) }, [state.horror, onHorrorChange])
  useEffect(() => { onSessionStatusChange?.(status) }, [status, onSessionStatusChange])
  const stage = demo ? previewStage : evolution.stage
  const stageName = ['Wisp', 'Haunted', 'Possessed'][stage - 1]
  const cameraConnected = attentionConnected ?? (suppliedAttention ? suppliedAttention !== 'unknown' : liveCameraConnected)
  const attentionLabel = !cameraConnected ? 'Not connected' : ({ unknown: 'Unknown', facing: 'Facing screen', away: 'Looking away' })[attentionStatus]
  const screenLabel = ({ not_checked: 'Not checked', relevant: 'Relevant', unrelated: 'Unrelated', uncertain: 'Uncertain', checking: 'Checking' })[screenStatus]
  const lastReward = (state.history.find(item => item.id === state.lastCompletedId)?.durationMinutes ?? 0) * 2
  return <div className="app-shell">
    <Spiderweb className="page-web" />
    <header className="site-header">
      <a className="wordmark" href={demo ? '?demo=1' : './'} aria-label="GhostMode home"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M5 31V15C5 0 27 0 27 15v16l-6-3-5 4-5-4Z" /><ellipse cx="12" cy="15" rx="2" ry="3" /><ellipse cx="21" cy="15" rx="2" ry="3" /></svg>Ghost<span>Mode</span></a>
      <h1>Stay focused. <span>Or get haunted.</span></h1>
      <div className={`session-status ${status}`}><span />{status === 'running' ? 'Focus in progress' : status === 'paused' ? 'Session paused' : status === 'completed' ? 'Session complete' : 'Ready to focus'}</div>
    </header>
    <main>
      {!session.storageAvailable && <p className="storage-notice" role="alert">Browser storage is unavailable. Your session still works, but progress may be lost when you close this page.</p>}
      {demo && <p className="storage-notice">Companion preview is on. Ghost moods and forms are a demo; your focus time and progress remain real.</p>}
      <div className="study-room">
        <StudyTimer session={session} draggingTask={draggingTask} onFocusTask={id => void focusTask(id)} onDragTask={setDraggingTask} focusNotice={focusNotice} onStart={() => void startFocus()} starting={starting} />
        <section className={`companion-panel mood-${mood} ${evolved ? 'just-evolved' : ''}`} aria-labelledby="companion-heading">
          <Spiderweb className="companion-web" /><CrawlingSpider />
          <div className="section-top"><span className="eyebrow">YOUR COMPANION</span><span className="stage-tag">{demo ? 'PREVIEW · ' : ''}{stageName}</span></div>
          <div className="portrait">
            <div className="portrait-arch" aria-hidden="true" />
            <Suspense fallback={<div className="ghost-loading">Loading Morrow…</div>}><GhostPet mood={mood} stage={stage} reaction={reaction} horrorEnabled={state.horror || demo} /></Suspense>
            <span className="portrait-floor" aria-hidden="true" />
          </div>
          <div className="companion-name"><h2 id="companion-heading">Morrow</h2><span className="mood-label">{mood}</span></div>
          <p className="companion-copy">{mood === 'idle' && status === 'running' ? 'Morrow is watching the timer.' : moodCopy[mood]}</p>
          <button className="pet-button" onClick={() => setReaction(value => value + 1)}>Pet Morrow</button>
          <div className={`evolution-progress ${xpEffect ? 'xp-gained' : ''}`}><div><span className="xp-total">{formatXp(xp)} <small>XP</small>{xpEffect && <span className="xp-reward">+{formatXp(lastReward)} XP</span>}</span><span>{evolution.next ? `${formatXp(evolution.next - xp)} XP to ${evolution.stage === 1 ? 'Haunted' : 'Possessed'}` : 'Final form unlocked'}</span></div>
            <div className="xp-track" role="progressbar" aria-label="Evolution progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(evolution.progress)}><span style={{ width: `${evolution.progress}%` }} /></div>
            <div className="evolution-steps"><span className={evolution.stage >= 1 ? 'unlocked' : ''}>Wisp <small>0 XP</small></span><span className={evolution.stage >= 2 ? 'unlocked' : ''}>Haunted <small>100 XP</small></span><span className={evolution.stage >= 3 ? 'unlocked' : ''}>Possessed <small>300 XP</small></span></div>
            <span className="evolution-notice" role="status">{evolved ? `Evolved to ${evolution.name}!` : ''}</span>
          </div>
        </section>
        <TaskList session={session} onFocusTask={id => void focusTask(id)} onDragTask={setDraggingTask} />
      <section className="monitoring-strip" aria-label="Focus monitoring">
        <div className="monitoring-title"><h2>Focus monitoring</h2><p>Camera is optional. Starting a session asks you to share a screen for Gemma check-ins.</p></div>
        <div className={`monitor-item ${cameraConnected ? attentionStatus : 'disconnected'}`}><svg className="monitor-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 6-3v10l-6-3" /></svg><div><h3>Webcam attention</h3><p className="monitor-result"><span className="monitor-dot" />{attentionLabel}</p>{focusMonitor ?? <FocusMonitor isSessionActive={status === 'running'} horrorEnabled={state.horror} onAttentionChange={setLiveAttention} onConnectionChange={setLiveCameraConnected} />}</div></div>
        <div className={`monitor-item ${screenStatus}`}><svg className="monitor-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4M8 10l3 3 5-5" /></svg><div><h3>AI screen analysis</h3><p className="monitor-result"><span className="monitor-dot" />{screenLabel}</p>{screenMonitor ?? <>
          <p className="monitor-help">{screen.isSharing ? 'Sharing active. Your selected screen is sent to Gemma every 30 seconds while the timer runs.' : screen.isRequesting ? 'Choose a screen in the browser permission window.' : status === 'running' ? 'Screen sharing is off. Share a screen to enable check-ins.' : 'Screen sharing stops when you pause or finish. Screen images are sent to Gemma for analysis.'}</p>
          <div className="monitor-actions">{screen.isSharing ? <><button onClick={screen.stopSharing}>Stop sharing</button><button disabled={screen.isAnalysing || !state.goal.trim()} onClick={() => void screen.analyseNow()}>{screen.isAnalysing ? 'Checking…' : 'Check now'}</button></> : <button disabled={status !== 'running' || screen.isRequesting} onClick={() => void screen.startSharing()}>{screen.isRequesting ? 'Awaiting permission…' : 'Share screen'}</button>}</div>
          {!state.goal.trim() && <p className="monitor-help">Choose a task or type a current goal to enable analysis.</p>}
          {screen.error && <p className="monitor-error" role="alert">{screen.error}</p>}
          {screen.isSharing && screen.analysis && <div className={`screen-feedback ${screen.analysis.relevance}`} role={screen.analysis.relevance === 'unrelated' ? 'alert' : 'status'}><strong>{screen.analysis.relevance === 'unrelated' ? 'Morrow noticed a distraction.' : screen.analysis.relevance === 'relevant' ? 'You’re on task.' : 'Morrow isn’t sure yet.'}</strong><p>{screen.analysis.explanation}</p>{screen.analysis.suggestions.length > 0 && <ul>{screen.analysis.suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>}</div>}
        </>}</div></div>
        <label className="horror-toggle"><input type="checkbox" checked={state.horror} onChange={event => void session.dispatch({ type: 'horror', value: event.target.checked })} /><span><strong>Haunted reactions</strong><small>{state.horror ? 'On · Morrow can get angry' : 'Off · keep things friendly'}</small></span></label>
      </section>
      </div>
      <section className="journal" aria-labelledby="journal-heading">
        <div className="journal-heading"><h2 id="journal-heading">Your progress</h2></div>
        <div className="stat"><span className="stat-value">{Math.floor(minutes / 60)}<small>h</small> {Math.floor(minutes % 60)}<small>m</small>{Math.round(minutes * 60) % 60 > 0 && <>{Math.round(minutes * 60) % 60}<small>s</small></>}</span><span>Total focus time</span></div>
        <div className="stat"><span className="stat-value">{String(sessions).padStart(2, '0')}</span><span>Sessions completed</span></div>
        <div className="stat"><span className="stat-value">{String(evolution.stage).padStart(2, '0')}<small>/ 03</small></span><span>{evolution.name} evolution</span></div>
        <div className="stat"><span className="stat-value">{String(state.tasks.filter(task => task.completed).length).padStart(2, '0')}</span><span>Tasks completed</span></div>
      </section>
      <section className="history" aria-labelledby="history-heading"><div className="history-heading"><h3 id="history-heading">Session history</h3><span>Latest {Math.min(5, sessions)} of {sessions}</span></div>
        {state.history.length === 0 ? <div className="empty-history"><p>No completed sessions yet.</p></div> : <ul>{[...state.history].reverse().slice(0, 5).map(item => <li key={item.id}><span className="history-check" aria-hidden="true">✓</span><div><strong>{item.task || 'Focus session'}</strong><time dateTime={item.completedAt}>{new Date(item.completedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><span>{formatDuration(item.durationMinutes)}</span><span className="history-xp">+{formatXp(item.durationMinutes * 2)} XP</span></li>)}</ul>}
      </section>
      <JumpScare
        isOpen={screenDistraction && state.horror}
        onClose={() => setScreenDistraction(false)}
        eyebrow="MORROW NOTICED"
        title="That screen is off task."
        description="Gemma detected content unrelated to your current goal. Close the distraction and get back to your study session."
        face="⚠"
      />
      {demo && <section className="demo-controls" aria-label="Demo controls"><div><strong>Companion preview · demo mode</strong><p>Preview only. Your timer, XP and session history stay real.</p></div><label>Mood<select value={previewMood} onChange={event => setPreviewMood(event.target.value as GhostMood)}>{moods.map(value => <option key={value}>{value}</option>)}</select></label><label>Evolution<select value={previewStage} onChange={event => setPreviewStage(Number(event.target.value) as EvolutionStage)}><option value={1}>1 · Wisp</option><option value={2}>2 · Haunted</option><option value={3}>3 · Possessed</option></select></label><button onClick={() => { setDemoCelebration(value => value + 1); setReaction(value => value + 1) }}>Preview celebration</button></section>}
    </main>
    <footer>{session.storageAvailable ? 'Progress saved on this browser.' : 'Progress is kept in memory for this visit.'}</footer>
  </div>
}
