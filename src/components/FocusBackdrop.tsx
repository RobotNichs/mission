import type { FocusEnvironment } from '../services/focusEnvironment'

// Fixed shapes: no random redistribution or JavaScript animation loop.
const waves = [
  'M-200 190 C80 120 260 270 520 190 S960 110 1400 190',
  'M-200 300 C100 230 290 390 550 300 S1000 220 1400 300',
  'M-200 430 C60 350 310 520 600 430 S1010 340 1400 430',
  'M-200 580 C120 490 320 670 560 580 S980 490 1400 580',
  'M-200 720 C90 630 310 810 610 720 S1010 640 1400 720',
]
export default function FocusBackdrop({ environment }: { environment: FocusEnvironment }) {
  const water = <svg viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
    {waves.map(path => <path key={path} d={path} />)}
  </svg>
  return <div className="focus-backdrop" aria-hidden="true">
    <span className="focus-atmosphere">{environment === 'liquid' && water}</span>
    <span className="focus-atmosphere-detail">{environment === 'liquid' && water}</span>
  </div>
}
