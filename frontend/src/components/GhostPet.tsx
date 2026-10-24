import { Component, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { EvolutionStage, GhostMood } from '../types'
import { GhostModel } from './ghost/GhostModel'

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}
function Fallback() {
  return <div className="ghost-fallback"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M5 31V15C5 0 27 0 27 15v16l-6-3-5 4-5-4Z" /><ellipse cx="12" cy="15" rx="2" ry="3" /><ellipse cx="21" cy="15" rx="2" ry="3" /></svg><p>Morrow’s 3D view is unavailable.</p><small>Your timer, tasks and progress still work.</small></div>
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Fallback /> : this.props.children }
}
export default function GhostPet({ mood, stage, reaction = 0, horrorEnabled = false }: {
  mood: GhostMood; stage: EvolutionStage; reaction?: number; horrorEnabled?: boolean
}) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden)
  const [lost, setLost] = useState(false)
  return <div className="ghost-canvas" role="img" aria-label={`Morrow, a ${['Wisp', 'Haunted', 'Possessed'][stage - 1]} ghost, feeling ${mood}`}>
    {lost ? <Fallback /> : <SceneBoundary><Canvas orthographic camera={{ position: [0, .2, 7], zoom: 92 }} dpr={[1, 1.5]}
      frameloop={visible ? 'always' : 'never'} gl={{ alpha: true, antialias: true }} fallback={<Fallback />}
      onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true }) }}>
      <ambientLight intensity={1.1} color="#dfd0df" />
      <directionalLight position={[-3, 4, 5]} intensity={2.8} color="#ffe3c6" />
      <directionalLight position={[3, 1, -2]} intensity={1.9} color="#b3d5c5" />
      <pointLight position={[-2, -.8, 1]} intensity={3} color="#ff7518" distance={6} />
      <GhostModel mood={mood} stage={stage} reaction={reaction} reducedMotion={reducedMotion} horrorEnabled={horrorEnabled} />
    </Canvas></SceneBoundary>}
  </div>
}
