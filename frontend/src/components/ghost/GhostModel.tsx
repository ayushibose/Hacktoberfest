import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EvolutionStage, GhostMood } from '../../types'

// A single continuous porcelain silhouette: domed head, soft shoulders, scalloped cloth hem.
function createBody() {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  const rings = 42, segments = 64
  for (let row = 0; row <= rings; row++) {
    const v = row / rings
    const radius = v > .55 ? .84 * Math.sqrt(Math.max(0, 1 - ((v - .55) / .45) ** 2)) : .77 + .13 * Math.cos(v / .55 * Math.PI * 1.6)
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2
      const folds = (1 - v) ** 4
      const r = radius + Math.sin(angle * 7 + .4) * .065 * folds
      positions.push(Math.cos(angle) * r, -1.1 + v * 2.55 + Math.cos(angle * 7) * .14 * folds, Math.sin(angle) * r * .77)
      uvs.push(col / segments, v)
      if (row < rings && col < segments) {
        const a = row * (segments + 1) + col, b = a + segments + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

function createPorcelainTexture() {
  const pixels = new Uint8Array(64 * 64 * 4)
  for (let i = 0; i < 64 * 64; i++) {
    const grain = 128 + Math.sin(i * 17.23) * 35 + Math.sin(i * .31) * 18
    pixels.set([grain, grain, grain, 255], i * 4)
  }
  const texture = new THREE.DataTexture(pixels, 64, 64)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.repeat.set(3, 3)
  texture.needsUpdate = true
  return texture
}

export function GhostModel({ mood, stage, reaction, reducedMotion, horrorEnabled }: {
  mood: GhostMood; stage: EvolutionStage; reaction: number; reducedMotion: boolean; horrorEnabled: boolean
}) {
  const body = useMemo(() => createBody(), [])
  const porcelainTexture = useMemo(() => createPorcelainTexture(), [])
  const cracks = useMemo(() => [
    [[.5, .91, .4], [.44, .81, .48], [.49, .71, .49], [.43, .63, .54]],
    [[.49, .71, .49], [.59, .65, .42], [.61, .57, .43]],
    [[-.48, .12, .52], [-.42, .06, .57], [-.46, -.03, .55]],
  ].map(points => new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point as [number, number, number])), false, 'catmullrom', .1)), [])
  const smile = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.19, -.01, .64), new THREE.Vector3(-.06, -.09, .68), new THREE.Vector3(.09, -.085, .68), new THREE.Vector3(.2, .015, .64),
  ]), 24, .018, 6, false), [])
  useEffect(() => () => { body.dispose(); smile.dispose(); porcelainTexture.dispose() }, [body, smile, porcelainTexture])
  const root = useRef<THREE.Group>(null!)
  const face = useRef<THREE.Group>(null!)
  const eyes = useRef<THREE.Group>(null!)
  const mouth = useRef<THREE.Mesh>(null!)
  const leftArm = useRef<THREE.Mesh>(null!)
  const rightArm = useRef<THREE.Mesh>(null!)
  const porcelain = useRef<THREE.MeshPhysicalMaterial>(null!)
  const eyeMaterial = useRef<THREE.MeshStandardMaterial>(null!)
  const otherEyeMaterial = useRef<THREE.MeshStandardMaterial>(null!)
  const leftBrow = useRef<THREE.Mesh>(null!)
  const rightBrow = useRef<THREE.Mesh>(null!)
  const glints = useRef<THREE.Group>(null!)
  const hauntedLight = useRef<THREE.PointLight>(null!)
  const sparks = useRef<THREE.Group>(null!)
  const hover = useRef(false)
  const animation = useRef({ mood, reaction, started: 0, petAt: -10, nextBlink: 3, blinkAt: -10, time: 0 })
  const tint = useMemo(() => new THREE.Color(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock, pointer, size: canvasSize }, delta) => {
    const t = clock.elapsedTime, dt = Math.min(delta, .05), a = animation.current
    a.time = t
    if (a.mood !== mood) { a.mood = mood; a.started = t }
    if (a.reaction !== reaction) { a.reaction = reaction; a.petAt = t; if (mood === 'celebrating') a.started = t }
    if (t > a.nextBlink) { a.blinkAt = t; a.nextBlink = t + 3.1 + Math.random() * 3 }
    const celebration = mood === 'celebrating' && t - a.started < 3.8
    const petting = t - a.petAt < 1.4
    const cheerful = mood === 'happy' || celebration || petting
    const haunted = horrorEnabled && (mood === 'possessed' || mood === 'angry')
    const possessed = horrorEnabled && mood === 'possessed'
    const motion = reducedMotion ? 0 : 1
    const lerp = 1 - Math.exp(-dt * 5)
    const suspicious = mood === 'suspicious'
    const tilt = possessed ? -.62 : suspicious ? .29 : cheerful ? -.12 : .035
    root.current.position.y = THREE.MathUtils.lerp(root.current.position.y, motion * (Math.sin(t * (cheerful ? 4.5 : 1.4)) * (cheerful ? .13 : .065) + (celebration ? .15 : 0)), lerp)
    root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, tilt + Math.sin(t * 1.1) * .025 * motion, lerp)
    const turn = suspicious ? Math.sin(t * .35) * .035 * motion : hover.current ? Math.max(-.25, Math.min(.25, pointer.x * .3)) : Math.sin(t * .5) * .09 * motion
    // A brief, low-amplitude hesitation every few seconds; no flashing or rapid color changes.
    const hesitation = haunted && Math.sin(t * 1.4) > .96 ? Math.sin(t * 15) * .055 * motion : 0
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, turn + hesitation, lerp)
    const size = [.86, .94, 1][stage - 1] * Math.min(1, canvasSize.width / 320, canvasSize.height / 325)
    root.current.scale.lerp(scale.setScalar(size), lerp)
    face.current.rotation.z = THREE.MathUtils.lerp(face.current.rotation.z, possessed ? -.2 : suspicious ? .045 : 0, lerp)
    const blink = !reducedMotion && t - a.blinkAt < .16 ? .12 : 1
    eyes.current.scale.y = THREE.MathUtils.lerp(eyes.current.scale.y, blink * (suspicious ? .48 : haunted ? .75 : cheerful ? 1.12 : 1), lerp * 1.5)
    mouth.current.scale.y = THREE.MathUtils.lerp(mouth.current.scale.y, possessed ? 2.7 : mood === 'angry' ? -.9 : cheerful ? 1.4 : 1, lerp)
    mouth.current.scale.x = THREE.MathUtils.lerp(mouth.current.scale.x, possessed ? 1.35 : suspicious ? .8 : 1, lerp)
    leftBrow.current.rotation.z = THREE.MathUtils.lerp(leftBrow.current.rotation.z, haunted ? -.35 : suspicious ? .35 : .08, lerp)
    rightBrow.current.rotation.z = THREE.MathUtils.lerp(rightBrow.current.rotation.z, haunted ? .35 : suspicious ? .04 : -.08, lerp)
    glints.current.children.forEach(glint => glint.scale.setScalar(THREE.MathUtils.lerp(glint.scale.x, possessed ? .16 : 1, lerp)))
    leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, -.6 + (cheerful ? Math.sin(t * 6) * .25 * motion - .45 : Math.sin(t * 1.8) * .06 * motion), lerp)
    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, .6 + (cheerful ? Math.cos(t * 6) * .25 * motion + .45 : Math.cos(t * 1.8) * .06 * motion), lerp)
    porcelain.current.color.lerp(tint.set(haunted ? '#cfc1c7' : '#f1e9de'), lerp)
    eyeMaterial.current.emissive.lerp(tint.set(possessed ? '#390b14' : '#000000'), lerp)
    otherEyeMaterial.current.emissive.copy(eyeMaterial.current.emissive)
    hauntedLight.current.intensity = THREE.MathUtils.lerp(hauntedLight.current.intensity, haunted ? possessed ? 5 : 3 : 0, lerp)
    sparks.current.visible = celebration || stage > 1
    sparks.current.rotation.y = motion * t * (celebration ? .9 : .16)
    sparks.current.scale.setScalar(celebration ? 1.2 : 1)
  })
  return <group ref={root} onPointerOver={() => { hover.current = true }} onPointerOut={() => { hover.current = false }}
    onClick={event => { event.stopPropagation(); animation.current.petAt = animation.current.time }}>
    <pointLight ref={hauntedLight} position={[0, -.2, 2]} color="#c83b45" intensity={0} distance={6} decay={2} />
    <mesh geometry={body} castShadow><meshPhysicalMaterial ref={porcelain} color="#f1e9de" roughness={.36} metalness={.03} clearcoat={.5} bumpMap={porcelainTexture} bumpScale={.012} side={THREE.DoubleSide} /></mesh>
    <mesh ref={leftArm} position={[-.77, -.17, 0]} rotation={[0, 0, -.6]} scale={[.2, .43, .22]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#ece2d5" roughness={.4} /></mesh>
    <mesh ref={rightArm} position={[.77, -.22, 0]} rotation={[0, 0, .6]} scale={[.2, .4, .22]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#ece2d5" roughness={.4} /></mesh>
    <group ref={face}>
      <group ref={eyes} position={[0, .48, .58]}>
        {[-1, 1].map(side => <group key={side} position={[side * .29, side === 1 ? -.025 : 0, 0]}>
          <mesh scale={[stage === 1 ? .18 : .165, side === 1 ? .21 : .225, .09]}><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial ref={side === -1 ? eyeMaterial : otherEyeMaterial} color="#100b13" roughness={.11} metalness={.12} /></mesh>
        </group>)}
        <group ref={glints}>{[-1, 1].map(side => <group key={side} position={[side * .29, side === 1 ? -.025 : 0, 0]}>
          <mesh position={[-.045, .065, .085]} scale={[.046, .052, .015]}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#fff4e5" /></mesh>
          <mesh position={[.04, -.055, .088]} scale={[.018, .022, .01]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#ffb78d" /></mesh>
        </group>)}</group>
      </group>
      {[-1, 1].map(side => <mesh ref={side === -1 ? leftBrow : rightBrow} key={side} position={[side * .29, .79, .52]} scale={[.1, .012, .016]}><sphereGeometry args={[1, 16, 8]} /><meshStandardMaterial color="#50303c" /></mesh>)}
      {[-1, 1].map(side => <mesh key={side} position={[side * .47, .19, .51]} scale={[.11, .055, .028]} rotation={[0, side * .3, 0]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#c18e86" transparent opacity={.45} /></mesh>)}
      <mesh ref={mouth} geometry={smile}><meshStandardMaterial color="#50313a" /></mesh>
      {cracks.slice(0, stage === 1 ? 1 : 3).map((curve, index) => <mesh key={index}><tubeGeometry args={[curve, 16, .007, 4, false]} /><meshStandardMaterial color="#71525d" roughness={1} /></mesh>)}
      {stage >= 2 && [-1, 1].map(side => <mesh key={side} position={[side * .18, -.01, .66]} rotation={[0, 0, side * .4]}><boxGeometry args={[.012, .09, .01]} /><meshStandardMaterial color="#50313a" /></mesh>)}
      {stage >= 2 && <group position={[.49, .76, .43]} rotation={[0, .3, -.3]}>{[-1, 0, 1].map(value => <mesh key={value} position={[0, value * .07, 0]} rotation={[0, 0, .4]}><boxGeometry args={[.09, .012, .018]} /><meshStandardMaterial color="#735b60" /></mesh>)}</group>}
    </group>
    <group position={[-.52, .99, .35]} rotation={[.15, -.2, -.3]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * .15, 0, 0]} rotation={[0, 0, side * -.35]} scale={[.21, .14, .055]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color={stage === 3 ? '#551d2b' : '#9f3546'} roughness={.85} /></mesh>)}
      <mesh><sphereGeometry args={[.065, 20, 16]} /><meshStandardMaterial color="#2b1520" metalness={.25} roughness={.45} /></mesh>
      {[-1, 1].map(side => <group key={side} position={[side * .09, -.2, -.015]} rotation={[0, 0, side * -.3]}>
        <mesh><boxGeometry args={[.1, .32, .03]} /><meshStandardMaterial color="#8c3040" roughness={.85} /></mesh>
        <mesh position={[side * .03, 0, .017]}><boxGeometry args={[.009, .32, .005]} /><meshStandardMaterial color="#d09280" /></mesh>
      </group>)}
    </group>
    {stage >= 2 && <mesh position={[0, -.34, .62]}><sphereGeometry args={[.055, 16, 12]} /><meshStandardMaterial color="#b95830" metalness={.65} roughness={.3} /></mesh>}
    {stage === 3 && <group position={[0, 1.52, 0]} rotation={[.2, 0, -.12]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.36, .018, 8, 48]} /><meshStandardMaterial color="#bf7045" metalness={.7} roughness={.35} /></mesh>
      {[0, 1, 2, 3, 4].map(value => <mesh key={value} position={[Math.cos(value / 5 * Math.PI * 2) * .36, .1, Math.sin(value / 5 * Math.PI * 2) * .36]}><octahedronGeometry args={[.055]} /><meshStandardMaterial color="#d87540" metalness={.5} roughness={.3} /></mesh>)}
    </group>}
    <group ref={sparks}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * 1.2, Math.sin(i * 1.7) * .9, Math.sin(i * 2.4) * .75]}><sphereGeometry args={[i % 3 === 0 ? .025 : .015, 8, 6]} /><meshBasicMaterial color="#95d5ac" transparent opacity={.6} /></mesh>)}</group>
  </group>
}
