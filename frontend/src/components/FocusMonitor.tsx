import { useEffect } from 'react'
import { useFaceTracking } from '../hooks/useFaceTracking'
import type { AttentionStatus, FocusStatus } from '../types'
import JumpScare from './JumpScare'

interface FocusMonitorProps {
  isSessionActive: boolean
  alertAfterSeconds?: number
  horrorEnabled?: boolean
  onStatusChange?: (status: FocusStatus) => void
  onAttentionChange?: (status: AttentionStatus) => void
  onConnectionChange?: (connected: boolean) => void
  onScare?: () => void
}

export default function FocusMonitor({ isSessionActive, alertAfterSeconds = 30, horrorEnabled = true, onStatusChange, onAttentionChange, onConnectionChange, onScare }: FocusMonitorProps) {
  const { videoRef, status, headDirection, headAngles, awaySeconds, cameraOn, loading, error, jumpscare, calibrated, trackingWarning, framesProcessed,
    startCamera, stopCamera, calibrate, dismissJumpscare } = useFaceTracking(isSessionActive, alertAfterSeconds)
  useEffect(() => {
    onStatusChange?.(status)
    onAttentionChange?.(!cameraOn || !calibrated || trackingWarning || headDirection === 'Head position unavailable' ? 'unknown' : status === 'focused' ? 'facing' : status === 'camera-off' ? 'unknown' : 'away')
  }, [status, cameraOn, calibrated, headDirection, trackingWarning, onStatusChange, onAttentionChange])
  useEffect(() => { onConnectionChange?.(cameraOn) }, [cameraOn, onConnectionChange])
  useEffect(() => { if (jumpscare && !horrorEnabled) dismissJumpscare() }, [jumpscare, horrorEnabled, dismissJumpscare])
  return <div className="camera-controls">
    <div className={`camera-frame ${cameraOn ? 'camera-frame--on' : ''}`}>
      <video ref={videoRef} autoPlay muted playsInline className={`camera-preview ${cameraOn ? 'visible' : ''}`} aria-label="Your webcam preview" />
      {!cameraOn && <div className="camera-placeholder">
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="12" width="25" height="24" rx="5" /><path d="m32 20 10-6v20l-10-6M8 7l32 34" /></svg>
        <strong>{loading ? 'Starting camera…' : 'Camera not on'}</strong>
        <p>{loading ? 'Allow camera access, then wait for face tracking to load.' : 'Your webcam stays private and processes attention on this device.'}</p>
        <button onClick={loading ? stopCamera : () => void startCamera()}>{loading ? 'Cancel camera' : 'Enable camera'}</button>
      </div>}
    </div>
    <p className="monitor-help">{loading ? 'Loading face tracking…' : cameraOn ? trackingWarning || (calibrated ? headDirection : 'Face the screen normally, then calibrate.') : 'Enable the camera and calibrate before tracking attention.'}</p>
    {cameraOn && calibrated && <p className="attention-timer">{trackingWarning ? 'Away timer suspended until live tracking returns.' : isSessionActive ? `${awaySeconds}s continuously looking away · alert at ${alertAfterSeconds}s` : 'Away timer paused — start or resume a focus session.'}</p>}
    {error && <p className="monitor-error" role="alert">{error}</p>}
    <div className="monitor-actions">
      {cameraOn && <>
        {cameraOn && <button onClick={calibrate}>{calibrated ? 'Recalibrate' : 'Calibrate'}</button>}
        <button onClick={stopCamera}>Stop camera</button>
      </>}
    </div>
    {cameraOn && <details className="tracking-details"><summary>Tracking details</summary><p>Frames processed: {framesProcessed}</p><p>Horizontal {headAngles.yaw.toFixed(1)}° · Vertical {headAngles.pitch.toFixed(1)}°</p><p>{calibrated ? 'Calibrated' : 'Not calibrated'} · {horrorEnabled ? `Haunted alert enabled at ${alertAfterSeconds}s away.` : 'Haunted reactions off — no fullscreen alert.'}</p></details>}
    <JumpScare isOpen={jumpscare && horrorEnabled} onClose={dismissJumpscare} onOpen={onScare} />
  </div>
}
