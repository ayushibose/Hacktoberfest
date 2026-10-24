import { useState } from 'react'
import { DURATIONS, isValidDuration, MIN_DURATION, MAX_DURATION, TASK_DRAG_TYPE } from '../lib/studySession'
import type { useStudySession } from '../hooks/useStudySession'

export function StudyTimer({ session, draggingTask, onFocusTask, onDragTask, focusNotice }: {
  session: ReturnType<typeof useStudySession>; draggingTask: string | null
  onFocusTask: (id: string) => void; onDragTask: (id: string | null) => void; focusNotice: string
}) {
  const { state, status, remaining, dispatch, start } = session
  const seconds = Math.ceil(remaining / 1000)
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secondsText = String(seconds % 60).padStart(2, '0')
  const duration = state.active?.durationMinutes ?? state.duration
  const [customDraft, setCustomDraft] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const customValue = customDraft ?? String(duration)
  const customInvalid = state.durationMode === 'custom' && !isValidDuration(Number(customValue))
  const progress = 100 - remaining / (duration * 60_000) * 100
  return <section className={`timer-panel ${draggingTask ? 'drop-ready' : ''} ${dragOver ? 'drop-over' : ''}`} aria-labelledby="timer-heading"
    onDragOver={event => { if (event.dataTransfer.types.includes(TASK_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOver(true) } }}
    onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragOver(false) }}
    onDrop={event => {
      const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE)
      if (taskId) { event.preventDefault(); onFocusTask(taskId) }
      setDragOver(false); onDragTask(null)
    }}>
    <div className="panel-heading"><div><span className="eyebrow">MAKE TIME. FEED YOUR GHOST.</span><h2 id="timer-heading">Focus session</h2></div><span className={`timer-state ${status}`}>{status === 'running' ? 'Focusing' : status === 'paused' ? 'Paused' : status === 'completed' ? 'Complete' : 'Ready'}</span></div>
    <div className="duration-options" aria-label="Focus duration">
      {DURATIONS.map(value => <button key={value} aria-pressed={state.durationMode === 'preset' && duration === value} disabled={!!state.active}
        onClick={() => { setCustomDraft(null); void dispatch({ type: 'duration', value }) }}>{value} <span>min</span></button>)}
      <button aria-pressed={state.durationMode === 'custom'} disabled={!!state.active} onClick={() => { setCustomDraft(null); void dispatch({ type: 'duration', value: duration, custom: true }) }}>Custom</button>
    </div>
    {state.durationMode === 'custom' && <div className="custom-duration"><label htmlFor="custom-minutes">Minutes</label>
      <input id="custom-minutes" type="number" inputMode="numeric" min={MIN_DURATION} max={MAX_DURATION} step={1} value={state.active ? duration : customValue}
        disabled={!!state.active} aria-invalid={customInvalid} aria-describedby="duration-help"
        onChange={event => { const value = event.target.value; setCustomDraft(value); if (isValidDuration(Number(value))) void dispatch({ type: 'duration', value: Number(value), custom: true }) }}
        onBlur={() => { if (!customInvalid) setCustomDraft(null) }} />
      <span id="duration-help" className={customInvalid ? 'field-error' : ''}>{customInvalid ? 'Enter a whole number from 5 to 180.' : '5–180 minutes'}</span>
    </div>}
    <div className="countdown" role="timer" aria-label={`${minutesText} minutes ${secondsText} seconds remaining`}>
      {minutesText}<span className="timer-colon">:</span>{secondsText}
    </div>
    <div className="timer-caption">{status === 'running' ? 'Focus in progress' : status === 'paused' ? 'Paused. Resume when you’re ready.' : status === 'completed' ? 'Session complete' : `${duration} minutes · ${duration * 2} XP on completion`}</div>
    <div className="timer-track" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
    <div className="goal-heading"><label className="goal-label" htmlFor="study-goal">Current task</label>{state.selectedTaskId && <span>From your task list</span>}</div>
    <input id="study-goal" maxLength={200} value={state.goal} placeholder="Choose a task below or type a goal"
      onChange={event => void dispatch({ type: 'goal', value: event.target.value })} />
    <div className="focus-notice" role="status">{focusNotice}</div>
    <div className="timer-actions">
      <button className="primary-button" disabled={!state.active && customInvalid} onClick={() => status === 'running' ? void dispatch({ type: 'pause' }) : status === 'paused' ? void dispatch({ type: 'resume' }) : void start()}>
        <span aria-hidden="true">{status === 'running' ? 'Ⅱ' : '▷'}</span>
        {status === 'running' ? 'Pause session' : status === 'paused' ? 'Resume session' : status === 'completed' ? 'Start another session' : 'Start focus session'}
      </button>
      {(state.active || status === 'completed') && <button className="reset-button" onClick={() => void dispatch({ type: 'cancel' })}>{status === 'completed' ? 'Reset' : 'Cancel'}</button>}
    </div>
    <div className="completion-message" role="status">{status === 'completed' && `Nice work. +${(state.history.find(item => item.id === state.lastCompletedId)?.durationMinutes ?? 0) * 2} XP.`}</div>
    {draggingTask && <div className="drop-indicator" aria-hidden="true">Drop task here to focus</div>}
  </section>
}
