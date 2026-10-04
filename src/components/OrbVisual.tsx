import type { CSSProperties } from 'react'
import type { OrbDefinition } from '../types/gamification'
import { defaultOrb } from '../services/orbCatalog'

type Props = { orb?: OrbDefinition; className?: string; label?: string; style?: CSSProperties }

export default function OrbVisual({ orb = defaultOrb, className = '', label, style }: Props) {
  const { colors, material, pattern, ring, animated } = orb.visual
  return (
    <span className={`orb-art material-${material} pattern-${pattern} ${ring ? 'has-ring' : ''} ${animated ? 'is-animated' : ''} ${orb.visual.prestigeStyle ? `prestige-${orb.visual.prestigeStyle}` : ''} ${className}`}
      data-orb-id={orb.id} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ '--orb-light': colors[0], '--orb-mid': colors[1], '--orb-dark': colors[2], ...style } as CSSProperties}>
      {orb.visual.prestigeStyle && <span className="prestige-aura" />}
      <span className="orb-surface" />
      <svg className="orb-detail" viewBox="0 0 100 100" aria-hidden="true">
        {orb.visual.prestigeStyle === 'astral' && <circle className="prestige-lines" cx="50" cy="50" r="46" />}
        {orb.visual.prestigeStyle === 'orbit' && <g className="prestige-lines"><ellipse cx="50" cy="50" rx="47" ry="20" transform="rotate(-25 50 50)" /><circle cx="89" cy="35" r="2" /></g>}
        {orb.visual.prestigeStyle === 'pulsar' && <g className="prestige-lines"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="39" strokeDasharray="1 7" /></g>}
        {orb.visual.prestigeStyle === 'zenith' && <g className="prestige-lines"><ellipse cx="50" cy="50" rx="45" ry="24" transform="rotate(-35 50 50)" /><ellipse cx="50" cy="50" rx="45" ry="24" transform="rotate(35 50 50)" /><circle cx="50" cy="50" r="43" strokeDasharray="24 15 2 15" /></g>}
        {orb.visual.prestigeStyle === 'singularity' && <g className="prestige-lines"><circle cx="50" cy="50" r="45" /><ellipse cx="50" cy="50" rx="47" ry="27" transform="rotate(-30 50 50)" /><ellipse cx="50" cy="50" rx="47" ry="27" transform="rotate(30 50 50)" /><circle cx="50" cy="50" r="35" strokeDasharray="1 5" /></g>}
        {pattern === 'stars' && <g className="orb-stars"><path d="M28 19l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM65 44l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><circle cx="43" cy="64" r="1.5" /><circle cx="72" cy="29" r="1" /><circle cx="27" cy="58" r="1" /></g>}
        {pattern === 'facets' && <path className="orb-lines" d="M20 26L53 12 82 34 72 78 35 87 15 59zM20 26L48 49 53 12M82 34L48 49 72 78M35 87L48 49 15 59" />}
        {pattern === 'petals' && <g className="orb-lines"><ellipse cx="50" cy="50" rx="15" ry="34" /><ellipse cx="50" cy="50" rx="15" ry="34" transform="rotate(60 50 50)" /><ellipse cx="50" cy="50" rx="15" ry="34" transform="rotate(120 50 50)" /></g>}
        {pattern === 'halo' && <g className="orb-lines"><circle cx="50" cy="50" r="27" /><circle cx="50" cy="50" r="20" strokeDasharray="2 5" /></g>}
        {ring && <ellipse className="orb-ring" cx="50" cy="50" rx="47" ry="17" transform="rotate(-28 50 50)" />}
      </svg>
    </span>
  )
}
