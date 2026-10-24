import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface JumpScareProps { isOpen: boolean; onClose: () => void; onOpen?: () => void }
export default function JumpScare({ isOpen, onClose, onOpen }: JumpScareProps) {
  const button = useRef<HTMLButtonElement>(null)
  const playedForOpen = useRef(false)
  useLayoutEffect(() => {
    if (!isOpen) { playedForOpen.current = false; return }
    // Parent updates must not restart the audio while the same alert is open.
    if (!playedForOpen.current) { playedForOpen.current = true; onOpen?.() }
  }, [isOpen, onOpen])
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement
    button.current?.focus()
    return () => { if (previous instanceof HTMLElement) previous.focus() }
  }, [isOpen])
  if (!isOpen) return null
  return createPortal(<div className="distraction-overlay" role="alertdialog" aria-modal="true" aria-labelledby="distraction-title" aria-describedby="distraction-description" onKeyDown={event => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'Tab') { event.preventDefault(); button.current?.focus() }
  }}>
    <div className="scare-ghost" aria-hidden="true"><i className="scare-eye scare-eye--left" /><i className="scare-eye scare-eye--right" /><i className="scare-mouth" /><i className="scare-drip scare-drip--left" /><i className="scare-drip scare-drip--right" /></div>
    <div className="distraction-dialog">
      <svg className="distraction-face" viewBox="0 0 92 92" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="m20 23 52 46M72 23 20 69M10 27l15-4 5-14m47 18-15-4-5-14M10 65l15 4 5 14m47-18-15 4-5 14" /><path d="M24 42c0-18 44-18 44 0v20c0 13-10 22-22 22S24 75 24 62Z" /><path d="M34 52h8m8 0h8M37 70h18m-13-8v10m8-10v10" /></g><path className="blood-drop" d="M38 74c-4 6-5 10-1 13 5 3 9-3 1-13Zm16 0c-4 6-5 10-1 13 5 3 9-3 1-13Z" /></svg>
      <span className="eyebrow">MORROW NOTICED</span><h2 id="distraction-title">BOO! Back to your task.</h2><p id="distraction-description">Your ghost caught you looking away. Your study session is still running.</p><button className="primary-button" ref={button} onClick={onClose}>I'm back!</button>
    </div>
  </div>, document.body)
}
