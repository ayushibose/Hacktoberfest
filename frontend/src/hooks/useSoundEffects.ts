import { useCallback, useEffect, useRef, useState } from 'react'

export type SoundEffect = 'pet' | 'complete' | 'evolve' | 'scare'

/**
 * Tiny, self-contained Web Audio effects. The context is unlocked on the first
 * ordinary page interaction, allowing a later monitoring alert to play too.
 */
export function useSoundEffects() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('pomoghost:sound') !== 'off')
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('pomoghost:volume') ?? .45))
  const context = useRef<AudioContext | null>(null)

  const getContext = useCallback(() => {
    const audio = context.current ?? new AudioContext()
    context.current = audio
    return audio
  }, [])

  useEffect(() => { localStorage.setItem('pomoghost:sound', enabled ? 'on' : 'off') }, [enabled])
  useEffect(() => { localStorage.setItem('pomoghost:volume', String(volume)) }, [volume])
  useEffect(() => () => { void context.current?.close() }, [])
  useEffect(() => {
    const preload = document.createElement('link')
    preload.rel = 'preload'; preload.as = 'audio'; preload.href = '/sounds/morrow-scream.mp3'
    document.head.append(preload)
    return () => preload.remove()
  }, [])
  useEffect(() => {
    const unlock = () => { try { void getContext().resume() } catch { /* unavailable audio is non-fatal */ } }
    document.addEventListener('pointerdown', unlock, { once: true, capture: true })
    document.addEventListener('keydown', unlock, { once: true, capture: true })
    return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true) }
  }, [getContext])

  const play = useCallback((effect: SoundEffect) => {
    if (!enabled || volume <= 0) return
    try {
      if (effect === 'scare') {
        const screamAsset = new Audio('/sounds/morrow-scream.mp3')
        // Loud but not clipped or able to alter the user's system volume.
        screamAsset.volume = Math.max(.9, Math.min(1, Math.max(0, volume)))
        // This asset is bundled with the app; a user gesture unlocks audio at
        // startup, so a later monitoring event can play it without a prompt.
        screamAsset.currentTime = 0
        void screamAsset.play().catch(() => {})
        return
      }
      const audio = getContext()
      void audio.resume()
      const now = audio.currentTime
      const notes: Record<Exclude<SoundEffect, 'scare'>, number[]> = {
        pet: [523, 659, 784], complete: [392, 523, 659, 784], evolve: [196, 262, 330, 523],
      }
      notes[effect].forEach((frequency, index) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = effect === 'evolve' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(frequency, now + index * .075)
        gain.gain.setValueAtTime(.0001, now + index * .075)
        gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .18), now + index * .075 + .018)
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .075 + .19)
        oscillator.connect(gain).connect(audio.destination)
        oscillator.start(now + index * .075)
        oscillator.stop(now + index * .075 + .42)
      })
    } catch {
      // Sound is enhancement only; keep the focus tools usable on locked-down browsers.
    }
  }, [enabled, volume, getContext])

  return { enabled, setEnabled, volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : .45, setVolume, play }
}
