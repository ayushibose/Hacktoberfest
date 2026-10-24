export function Spiderweb({ className = '' }: { className?: string }) {
  const angles = Array.from({ length: 5 }, (_, i) => i * Math.PI / 8)
  return <svg className={`spiderweb ${className}`} viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
    <g transform="translate(120 0) scale(-1 1)">
      {angles.map(angle => <path key={angle} d={`M0 0L${Math.cos(angle) * 120} ${Math.sin(angle) * 120}`} />)}
      {[24, 49, 76, 105].map(radius => <path key={radius} d={angles.map((angle, index) => index === 0 ? `M${radius} 0` :
        `Q${Math.cos(angle - Math.PI / 16) * radius * .83} ${Math.sin(angle - Math.PI / 16) * radius * .83} ${Math.cos(angle) * radius} ${Math.sin(angle) * radius}`).join(' ')} />)}
    </g>
  </svg>
}

export function CrawlingSpider() {
  return <div className="spider-track" aria-hidden="true"><div className="crawling-spider"><span className="spider-thread" />
    <svg viewBox="0 0 40 48" focusable="false">
      <g className="spider-legs left-legs"><path d="m17 23-8-6-5-9m13 18-11-2-5-6m16 12L6 33l-4 7m15-8-7 8v7" /></g>
      <g className="spider-legs right-legs"><path d="m23 23 8-6 5-9m-13 18 11-2 5-6m-16 12 11 3 4 7m-15-8 7 8v7" /></g>
      <ellipse cx="20" cy="31" rx="6" ry="9" /><circle cx="20" cy="20" r="4.5" />
    </svg>
  </div></div>
}
