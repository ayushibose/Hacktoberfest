import { useCallback, useEffect, useRef, useState } from 'react'

export interface ScreenAnalysis {
  relevance: 'relevant' | 'unrelated' | 'uncertain'
  explanation: string
  suggestions: string[]
}

export interface UseScreenCaptureOptions {
  goal: string
  intervalMs?: number
  apiUrl?: string
  onAnalysis?: (analysis: ScreenAnalysis) => void
  onError?: (error: Error) => void
}

export interface UseScreenCaptureResult {
  isSharing: boolean
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
  return (
    (candidate.relevance === 'relevant' ||
      candidate.relevance === 'unrelated' ||
      candidate.relevance === 'uncertain') &&
    typeof candidate.explanation === 'string' &&
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.every((suggestion) => typeof suggestion === 'string')
  )
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const TEST_ANALYSIS_INTERVAL = 30 * 1000
const MAX_CAPTURE_WIDTH = 1280
const MAX_CAPTURE_HEIGHT = 720
const CAPTURE_QUALITY = 0.6

export function useScreenCapture({
  goal,
  intervalMs = TEST_ANALYSIS_INTERVAL,
  apiUrl = API_URL,
  onAnalysis,
  onError,
}: UseScreenCaptureOptions): UseScreenCaptureResult {
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ScreenAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const analyseNowRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const analysisInFlightRef = useRef(false)

  const stopSharing = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    videoRef.current?.remove()
    videoRef.current = null
    setIsSharing(false)
  }, [])

  const captureFrame = useCallback((): string => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error('The shared screen is not ready for capture.')
    }

    const canvas = document.createElement('canvas')
    const scale = Math.min(
      1,
      MAX_CAPTURE_WIDTH / video.videoWidth,
      MAX_CAPTURE_HEIGHT / video.videoHeight,
    )
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('The shared screen has no capturable dimensions.')
    }
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare the screen capture.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', CAPTURE_QUALITY)
  }, [])

  const analyseNow = useCallback(async () => {
    if (!isSharing) {
      setError('Start screen sharing before requesting an analysis.')
      return
    }
    if (!goal.trim()) {
      setError('Enter a study goal before requesting an analysis.')
      return
    }
    if (analysisInFlightRef.current) return

    analysisInFlightRef.current = true
    setIsAnalysing(true)
    setError(null)
    try {
      const imageDataUrl = captureFrame()
      setPreviewUrl(imageDataUrl)
      const response = await fetch(`${apiUrl}/api/analyse-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, imageDataUrl }),
      })
      const payload: unknown = await response.json()
      if (!response.ok || !isScreenAnalysis(payload)) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
            ? 'detail' in payload && typeof payload.detail === 'string'
              ? `${payload.error} ${payload.detail}`
              : payload.error
            : 'Screen analysis failed.'
        throw new Error(message)
      }
      setAnalysis(payload)
      onAnalysis?.(payload)
    } catch (captureError) {
      const error =
        captureError instanceof Error ? captureError : new Error('Screen analysis failed.')
      setError(error.message)
      onError?.(error)
    } finally {
      analysisInFlightRef.current = false
      setIsAnalysing(false)
    }
  }, [apiUrl, captureFrame, goal, isSharing, onAnalysis, onError])

  const startSharing = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()
      streamRef.current = stream
      videoRef.current = video
      setIsSharing(true)
      stream.getVideoTracks()[0]?.addEventListener('ended', stopSharing, { once: true })
      window.setTimeout(() => {
        void analyseNowRef.current()
      }, 500)
      timerRef.current = window.setInterval(() => {
        void analyseNowRef.current()
      }, intervalMs)
    } catch (captureError) {
      setError(
        captureError instanceof DOMException && captureError.name === 'NotAllowedError'
          ? 'Screen sharing was cancelled or permission was denied.'
          : captureError instanceof Error
            ? captureError.message
            : 'Unable to start screen sharing.',
      )
      stopSharing()
    }
  }, [intervalMs, stopSharing])

  useEffect(() => {
    analyseNowRef.current = analyseNow
  }, [analyseNow])

  useEffect(() => stopSharing, [stopSharing])

  return { isSharing, isAnalysing, previewUrl, analysis, error, startSharing, stopSharing, analyseNow }
}
