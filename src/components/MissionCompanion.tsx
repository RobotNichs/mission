import { useEffect, useId, useRef, useState } from 'react'
import './MissionCompanion.css'

export type CompanionState = 'idle' | 'focus' | 'success'
type Props = {
  size?: number
  state?: CompanionState
  animated?: boolean
  className?: string
  /** Omit for decorative instances. */
  label?: string
  /** Design inspection: the same contour, without face or lighting. */
  silhouette?: boolean
}

export default function MissionCompanion({ size = 120, state = 'idle', animated = true, className = '', label, silhouette = false }: Props) {
  const id = useId().replace(/:/g, '')
  const root = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries[0]) setVisible(entries[0].isIntersecting)
    })
    if (root.current) observer?.observe(root.current)
    return () => { document.removeEventListener('visibilitychange', update); observer?.disconnect() }
  }, [])
  const dimension = Number.isFinite(size) && size > 0 ? size : 120
  return <span ref={root} className={`mission-companion ${className}`} data-state={state}
    data-animated={animated && !silhouette} data-motion={visible && pageVisible ? 'running' : 'paused'}
    data-silhouette={silhouette} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ width: dimension, aspectRatio: '1' }}>
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-coat`} x1="62" y1="38" x2="138" y2="171" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D4B6B" /><stop offset=".55" stopColor="#2E3A56" /><stop offset="1" stopColor="#1B2336" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#8A7BE0" stopOpacity=".16" /><stop offset="1" stopColor="#8A7BE0" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-warmth`}><stop stopColor="#F5BEA4" stopOpacity=".55" /><stop offset="1" stopColor="#F5BEA4" stopOpacity="0" /></radialGradient>
      </defs>
      {!silhouette && <ellipse cx="100" cy="113" rx="92" ry="82" fill={`url(#${id}-halo)`} />}
      {/* Keyed only by expression: repeated success renders cannot restart the one-shot. */}
      <g key={state} className="companion-expression">
        <g className="companion-breath">
          {!silhouette && <ellipse className="companion-warmth" cx="100" cy="118" rx="88" ry="80" fill={`url(#${id}-warmth)`} opacity="0" />}
          <path className="companion-contour" d="M36 78C29 58 30 34 37 28C42 25 61 37 73 47C88 43 111 43 126 48C139 37 155 26 161 31C168 40 169 62 163 82C175 99 179 122 169 142C159 164 132 175 101 175C69 176 41 166 30 146C18 125 23 98 36 78Z"
            fill={silhouette ? 'currentColor' : `url(#${id}-coat)`} stroke={silhouette ? undefined : '#667397'} strokeWidth="1.6" />
          {!silhouette && <>
            <path className="companion-inner-ear" d="M40 43L44 70L60 53Z" fill="#8A7BE0" opacity=".32" />
            <path className="companion-inner-ear" d="M156 46L141 56L157 72Z" fill="#8A7BE0" opacity=".32" />
            <path d="M86 73Q87 67 90 64Q94 65 100 71Q105 65 109 65Q112 68 113 73" stroke="#A99BEF" strokeWidth="3.8" opacity=".88" strokeLinecap="round" strokeLinejoin="round" />
            {state === 'success' ? <g className="companion-eyes" stroke="#F7E6D3" strokeWidth="4" strokeLinecap="round">
              <path d="M57 106Q68 96 80 105M120 105Q132 96 143 106" />
            </g> : <g className="companion-eyes">
              <path d={state === 'focus' ? 'M55 104C61 100 74 100 81 104C79 110 73 113 67 113C61 113 57 110 55 104Z' : 'M55 102C60 97 74 97 81 102C79 109 73 114 67 114C61 114 57 110 55 102Z'} fill="#F7E6D3" />
              <path d={state === 'focus' ? 'M119 104C126 100 139 100 145 104C143 110 139 113 133 113C127 113 121 110 119 104Z' : 'M119 102C126 97 140 97 145 102C143 110 139 114 133 114C127 114 121 109 119 102Z'} fill="#F7E6D3" />
              <ellipse cx="69" cy="106" rx="3.5" ry={state === 'focus' ? 5 : 6} fill="#1B2336" /><ellipse cx="131" cy="106" rx="3.5" ry={state === 'focus' ? 5 : 6} fill="#1B2336" />
              <circle cx="70" cy="103.5" r="1.3" fill="#FFF8EF" /><circle cx="132" cy="103.5" r="1.3" fill="#FFF8EF" />
            </g>}
            <path d="M96 124Q100 122 104 124L100 129Z" fill="#F5BEA4" />
            <path className="companion-mouth" d="M100 129V133M93 134Q97 137 100 133Q103 137 107 134" stroke="#C8BECD" strokeWidth="1.8" strokeLinecap="round" />
          </>}
        </g>
      </g>
    </svg>
  </span>
}
