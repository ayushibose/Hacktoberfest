import { useCallback, useEffect, useRef, useState } from 'react'

export interface ScreenAnalysis {
  relevance: 'relevant' | 'unrelated' | 'uncertain'
  explanation: string
  suggestions: string[]
}
export interface UseScreenCaptureOptions {
  goal: string
  enabled?: boolean
  intervalMs?: number
  apiUrl?: string
  onAnalysis?: (analysis: ScreenAnalysis) => void
  onError?: (error: Error) => void
}
export interface UseScreenCaptureResult {
  isSharing: boolean
  isRequesting: boolean
  isAnalysing: boolean
  previewUrl: string | null
  analysis: ScreenAnalysis | null
  error: string | null
  startSharing: () => Promise<void>
  stopSharing: () => void
  analyseNow: () => Promise<void>
}
function isScreenAnalysis(value: unknown): value is ScreenAnalysis {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return ['relevant', 'unrelated', 'uncertain'].includes(String(candidate.relevance)) &&
    typeof candidate.explanation === 'string' && Array.isArray(candidate.suggestions) &&
    candidate.suggestions.every(suggestion => typeof suggestion === 'string')
}
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useScreenCapture({ goal, enabled = true, intervalMs = 30_000, apiUrl = API_URL, onAnalysis, onError }: UseScreenCaptureOptions): UseScreenCaptureResult {
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const initialTimerRef = useRef<number | null>(null)
  const generation = useRef(0)
  const requestRef = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const lastScreenSignature = useRef<string | null>(null)
  const analyseNowRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const [isSharing, setIsSharing] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ScreenAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stopSharing = useCallback(() => {
    generation.current++
    controller.current?.abort()
    controller.current = null
    if (timerRef.current !== null) clearInterval(timerRef.current)
    if (initialTimerRef.current !== null) clearTimeout(initialTimerRef.current)
    timerRef.current = null
    initialTimerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    videoRef.current = null
    // Keep a pending chooser locked until its promise settles; late streams are stopped.
    setIsSharing(false)
    setIsAnalysing(false)
    setPreviewUrl(null)
    setAnalysis(null)
    lastScreenSignature.current = null
  }, [])

  const analyseNow = useCallback(async () => {
    if (!enabled || !streamRef.current || controller.current) return
    if (!goal.trim()) { setError('Choose a current task before screen analysis.'); return }
    const currentGeneration = generation.current
    const abort = new AbortController()
    controller.current = abort
    setIsAnalysing(true)
    setError(null)
    const timeout = window.setTimeout(() => abort.abort(), 90_000)
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('The shared screen is not ready. Try Check now in a moment.')
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to prepare the screen capture.')
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      // Small quantised thumbnail: avoid paying for another model call when the
      // shared view has not materially changed since the prior interval.
      const fingerprint = document.createElement('canvas')
      fingerprint.width = 32; fingerprint.height = 18
      const fingerprintContext = fingerprint.getContext('2d', { willReadFrequently: true })
      if (fingerprintContext) {
        fingerprintContext.drawImage(canvas, 0, 0, fingerprint.width, fingerprint.height)
        const pixels = fingerprintContext.getImageData(0, 0, fingerprint.width, fingerprint.height).data
        let signature = ''
        for (let index = 0; index < pixels.length; index += 16) signature += `${pixels[index] >> 5}${pixels[index + 1] >> 5}${pixels[index + 2] >> 5}`
        if (signature === lastScreenSignature.current) { setIsAnalysing(false); controller.current = null; return }
        lastScreenSignature.current = signature
      }
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.6)
      const response = await fetch(`${apiUrl}/api/analyse-screen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, imageDataUrl }), signal: abort.signal,
      })
      const payload: unknown = await response.json()
      if (!response.ok || !isScreenAnalysis(payload)) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : 'Screen analysis failed.'
        throw new Error(message)
      }
      if (currentGeneration !== generation.current || abort.signal.aborted) return
      setAnalysis(payload)
      onAnalysis?.(payload)
    } catch (cause) {
      if (currentGeneration !== generation.current) return
      const failure = abort.signal.aborted ? new Error('Screen analysis timed out. Try Check now.') : cause instanceof Error ? cause : new Error('Screen analysis failed.')
      setError(failure.message)
      onError?.(failure)
    } finally {
      clearTimeout(timeout)
      if (controller.current === abort) { controller.current = null; setIsAnalysing(false) }
    }
  }, [apiUrl, enabled, goal, onAnalysis, onError])

  const startSharing = useCallback(async () => {
    if (requestRef.current || streamRef.current) return
    requestRef.current = true
    setIsRequesting(true)
    setError(null)
    const currentGeneration = ++generation.current
    let acquired: MediaStream | null = null
    try {
      // Invoke directly from the Start/Resume click, before any await or storage lock.
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing is unavailable in this browser. Try Chrome or Edge on localhost or HTTPS.')
      acquired = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      if (currentGeneration !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return }
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = acquired
      streamRef.current = acquired
      videoRef.current = video
      acquired.getVideoTracks()[0]?.addEventListener('ended', stopSharing, { once: true })
      await video.play()
      if (currentGeneration !== generation.current) {
        if (streamRef.current === acquired) stopSharing()
        else acquired.getTracks().forEach(track => track.stop())
        return
      }
      setIsSharing(true)
      initialTimerRef.current = window.setTimeout(() => void analyseNowRef.current(), 500)
      timerRef.current = window.setInterval(() => void analyseNowRef.current(), intervalMs)
    } catch (cause) {
      acquired?.getTracks().forEach(track => track.stop())
      if (currentGeneration !== generation.current) return
      stopSharing()
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Screen sharing was cancelled or permission was denied. Your timer can continue; use Share screen to retry.' : cause instanceof Error ? cause.message : 'Unable to share your screen.')
    } finally {
      requestRef.current = false
      setIsRequesting(false)
    }
  }, [intervalMs, stopSharing])

  useEffect(() => { analyseNowRef.current = analyseNow }, [analyseNow])
  useEffect(() => {
    // A result for an old task must never change the current task's mood or alert.
    generation.current++
    controller.current?.abort()
    controller.current = null
    // Clear UI for the aborted external request before the new goal can render a result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAnalysing(false)
    setAnalysis(null)
    setError(null)
    lastScreenSignature.current = null
  }, [goal])
  useEffect(() => {
    // Media tracks and their UI must stop together when the external session stops.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!enabled) stopSharing()
  }, [enabled, stopSharing])
  useEffect(() => stopSharing, [stopSharing])
  return { isSharing, isRequesting, isAnalysing, previewUrl, analysis, error, startSharing, stopSharing, analyseNow }
}
