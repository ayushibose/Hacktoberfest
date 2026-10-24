import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface JumpScareProps { isOpen: boolean; onClose: () => void }
export default function JumpScare({ isOpen, onClose }: JumpScareProps) {
  const button = useRef<HTMLButtonElement>(null)
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
    <div className="distraction-dialog"><span className="distraction-face" aria-hidden="true">☠</span><span className="eyebrow">MORROW NOTICED</span><h2 id="distraction-title">BOO! Back to your task.</h2><p id="distraction-description">Your ghost caught you looking away. Your study session is still running.</p><button className="primary-button" ref={button} onClick={onClose}>I'm back!</button></div>
  </div>, document.body)
}
