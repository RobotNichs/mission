import { useEffect, useId, useRef, useState } from 'react'
import './MissionCompanion.css'

export type CompanionState = 'idle' | 'focus' | 'success' | 'pause' | 'error' | 'offline' | 'levelUp'
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
  const small = dimension < 80
  const leftEye = 'M55 102C60 97 74 97 81 102C79 109 73 114 67 114C61 114 57 110 55 102Z'
  const eyeHeight = state === 'error' ? 1.45 : state === 'focus' ? .72 : state === 'pause' ? 1.05 : 1
  const eyeTransform = `translate(69 105) scale(1 ${eyeHeight}) translate(-69 -105)`
  const mouth: Record<CompanionState, string> = {
    idle: 'M100 129V133M93 134Q97 137 100 133Q103 137 107 134',
    focus: 'M100 129V132M96 134Q100 135 104 134',
    pause: 'M100 129V132M92 132Q100 141 108 132',
    error: 'M97 134C97 130 103 130 103 134C103 138 97 138 97 134Z',
    offline: 'M97 134Q100 135 103 134',
    success: 'M100 129V132M91 132Q100 142 109 132',
    levelUp: 'M91 131Q100 135 109 131Q108 145 100 146Q92 144 91 131Z',
  }
  const closedEyes = state === 'success' || state === 'offline'
  return <span ref={root} className={`mission-companion ${className}`} data-state={state}
    data-animated={animated && !silhouette} data-motion={visible && pageVisible ? 'running' : 'paused'}
    data-silhouette={silhouette} data-small={small} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ width: dimension, aspectRatio: '1' }}>
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-coat`} x1="62" y1="38" x2="138" y2="171" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D4B6B" /><stop offset=".55" stopColor="#2E3A56" /><stop offset="1" stopColor="#1B2336" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#8A7BE0" stopOpacity=".16" /><stop offset="1" stopColor="#8A7BE0" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-warmth`}><stop stopColor={state === 'levelUp' ? '#F7E6D3' : '#F5BEA4'} stopOpacity=".55" /><stop offset="1" stopColor={state === 'levelUp' ? '#8A7BE0' : '#F5BEA4'} stopOpacity="0" /></radialGradient>
      </defs>
      {!silhouette && <ellipse cx="100" cy="113" rx="92" ry="82" fill={`url(#${id}-halo)`} />}
      {/* Keyed only by expression: repeated success renders cannot restart the one-shot. */}
      <g key={state} className="companion-expression">
        <g className="companion-breath">
          {!silhouette && <ellipse className="companion-warmth" cx="100" cy="118" rx="88" ry="80" fill={`url(#${id}-warmth)`} opacity="0" />}
          <path className="companion-contour" d="M36 78C29 58 30 34 37 28C42 25 61 37 73 47C88 43 111 43 126 48C139 37 155 26 161 31C168 40 169 62 163 82C175 99 179 122 169 142C159 164 132 175 101 175C69 176 41 166 30 146C18 125 23 98 36 78Z"
            fill={silhouette ? 'currentColor' : `url(#${id}-coat)`} stroke={silhouette ? undefined : '#667397'} strokeWidth="1.6" />
          {!silhouette && <>
            <path className="companion-inner-ear companion-inner-ear-left" d="M40 43L44 70L60 53Z" fill="#8A7BE0" opacity=".32" />
            <path className="companion-inner-ear" d="M156 46L141 56L157 72Z" fill="#8A7BE0" opacity=".32" />
            <path d="M86 73Q87 67 90 64Q94 65 100 71Q105 65 109 65Q112 68 113 73" stroke="#A99BEF" strokeWidth="3.8" opacity=".88" strokeLinecap="round" strokeLinejoin="round" />
            {state === 'levelUp' ? <g className="companion-eyes companion-level-eyes">
              <g className="companion-level-open" visibility="hidden" opacity="0">
                <ellipse className="companion-eye-surface" cx="69" cy="105" rx="14" ry="12" fill="#F7E6D3" />
                <ellipse className="companion-eye-surface" cx="131" cy="105" rx="14" ry="12" fill="#F7E6D3" />
                <g className="companion-level-pupils" fill="#1B2336" visibility="hidden"><ellipse cx="69" cy="105" rx="3.5" ry="6" /><ellipse cx="131" cy="105" rx="3.5" ry="6" /></g>
                {!small && <g className="companion-level-hearts" visibility="hidden">
                  <path d="M69 111C65 108 61 104 63 101C64 98 68 98 69 101C70 98 74 98 75 101C77 104 73 108 69 111Z" fill="#F5BEA4" />
                  <path d="M131 111C127 108 123 104 125 101C126 98 130 98 131 101C132 98 136 98 137 101C139 104 135 108 131 111Z" fill="#A99BEF" />
                </g>}
              </g>
              <g className="companion-level-rest" visibility="visible" stroke="#F7E6D3" strokeWidth="4" strokeLinecap="round">
                <path d="M56 106Q68 90 81 105M119 105Q132 90 144 106" />
              </g>
            </g> : closedEyes ? <g className="companion-eyes" stroke="#F7E6D3" strokeWidth="4" strokeLinecap="round">
              <path d={state === 'offline' ? 'M58 105Q69 111 80 105M120 105Q131 111 142 105'
                : 'M57 106Q68 96 80 105M120 105Q132 96 143 106'} />
            </g> : <g className="companion-eyes">
              <path className="companion-eye-surface" d={leftEye} transform={eyeTransform} fill="#F7E6D3" />
              <path className="companion-eye-surface" d={leftEye} transform={`translate(200 0) scale(-1 1) ${eyeTransform}`} fill="#F7E6D3" />
              <g className="companion-gaze">
              <ellipse cx="69" cy="106" rx="3.5" ry={state === 'focus' ? 3.5 : 6} fill="#1B2336" /><ellipse cx="131" cy="106" rx="3.5" ry={state === 'focus' ? 3.5 : 6} fill="#1B2336" />
              <circle cx="70" cy="103.5" r="1.3" fill="#FFF8EF" /><circle cx="132" cy="103.5" r="1.3" fill="#FFF8EF" />
              </g>
            </g>}
            <path d="M96 124Q100 122 104 124L100 129Z" fill="#F5BEA4" />
            <path className="companion-mouth" d={mouth[state]} fill={state === 'levelUp' ? '#F5BEA4' : state === 'error' ? '#1B2336' : 'none'} stroke="#C8BECD" strokeWidth="1.8" strokeLinecap="round" />
          </>}
        </g>
      </g>
    </svg>
  </span>
}
