import { type ScreenAnalysis, useScreenCapture } from '../hooks/useScreenCapture'

export interface ScreenMonitorProps {
  goal: string
  onGoalChange?: (goal: string) => void
  onAnalysis?: (analysis: ScreenAnalysis) => void
  onUnrelated?: (analysis: ScreenAnalysis) => void
  onError?: (error: Error) => void
  intervalMs?: number
  apiUrl?: string
  showGoalInput?: boolean
}

export function ScreenMonitor({
  goal,
  onGoalChange,
  onAnalysis,
  onUnrelated,
  onError,
  intervalMs,
  apiUrl,
  showGoalInput = true,
}: ScreenMonitorProps) {
  const monitor = useScreenCapture({
    goal,
    intervalMs,
    apiUrl,
    onAnalysis: (analysis) => {
      onAnalysis?.(analysis)
      if (analysis.relevance === 'unrelated') onUnrelated?.(analysis)
    },
    onError,
  })

  return (
    <section className="screen-monitor" aria-labelledby="screen-monitor-title">
      <div className="screen-monitor__header">
        <div>
          <p className="eyebrow">Optional AI check-in</p>
          <h2 id="screen-monitor-title">Screen relevance</h2>
        </div>
        <span className={monitor.isSharing ? 'sharing-badge sharing-badge--active' : 'sharing-badge'}>
          {monitor.isSharing ? '● Sharing active' : '○ Not sharing'}
        </span>
      </div>
      {showGoalInput && (
        <>
          <label htmlFor="study-goal">What are you working on?</label>
          <input
            id="study-goal"
            value={goal}
            onChange={(event) => onGoalChange?.(event.target.value)}
            placeholder="e.g. Complete my Python assignment"
            maxLength={500}
          />
        </>
      )}
      <p className="screen-monitor__privacy">
        Your selected screen is sampled every 30 seconds for testing while sharing is active. Images are sent for
        analysis and are not stored by this app.
      </p>
      <div className="screen-monitor__actions">
        {!monitor.isSharing ? (
          <button type="button" onClick={() => void monitor.startSharing()}>
            Share screen
          </button>
        ) : (
          <>
            <button type="button" onClick={monitor.stopSharing}>
              Stop sharing
            </button>
            <button type="button" onClick={() => void monitor.analyseNow()} disabled={monitor.isAnalysing}>
              {monitor.isAnalysing ? 'Analysing…' : 'Analyze now'}
            </button>
          </>
        )}
      </div>
      {monitor.error && <p className="screen-monitor__error" role="alert">{monitor.error}</p>}
      {monitor.previewUrl && <img className="screen-monitor__preview" src={monitor.previewUrl} alt="Latest captured screen preview" />}
      {monitor.analysis && (
        <div
          className={`analysis-result analysis-result--${monitor.analysis.relevance}`}
          role={monitor.analysis.relevance === 'unrelated' ? 'alert' : undefined}
          aria-live={monitor.analysis.relevance === 'unrelated' ? 'assertive' : 'polite'}
        >
          <strong>
            {monitor.analysis.relevance === 'relevant'
              ? 'Looks relevant'
              : monitor.analysis.relevance === 'unrelated'
                ? 'Focus alert: this may be unrelated'
                : 'Not enough evidence'}
          </strong>
          <p>{monitor.analysis.explanation}</p>
          {monitor.analysis.suggestions.length > 0 && (
            <ul>{monitor.analysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
          )}
        </div>
      )}
    </section>
  )
}
