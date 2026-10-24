import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface JumpScareProps {
  isOpen: boolean
  onClose: () => void
  eyebrow?: string
  title?: string
  description?: string
  face?: string
}
export default function JumpScare({
  isOpen,
  onClose,
  eyebrow = 'MORROW NOTICED',
  title = 'BOO! Back to your task.',
  description = 'Your ghost caught you looking away. Your study session is still running.',
  face = '☠',
}: JumpScareProps) {
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
  }} >
    <div className="distraction-dialog"><span className="distraction-face" aria-hidden="true">{face}</span><span className="eyebrow">{eyebrow}</span><h2 id="distraction-title">{title}</h2><p id="distraction-description">{description}</p><button className="primary-button" ref={button} onClick={onClose}>I'm back!</button></div>
  </div>, document.body)
}
