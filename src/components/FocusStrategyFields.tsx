import { blockSummary, validFocusStrategy, type FocusStrategy } from '../services/focusBlocks'
export default function FocusStrategyFields({ value, onChange, minutes }: { value?: FocusStrategy; onChange: (s: FocusStrategy) => void; minutes: number }) {
  const strategy = value ?? { mode: 'free' }, summary = blockSummary(minutes, strategy)
  return <div className="focus-strategy-fields"><label>Fokusstrategie<select value={strategy.mode} onChange={e => onChange(e.target.value === 'custom' ? { mode: 'custom', focusMinutes: 25, breakMinutes: 5 } : { mode: e.target.value as 'free' | 'pomodoro' | '50-10' })}>
    <option value="free">Frei</option><option value="pomodoro">Pomodoro 25 / 5</option><option value="50-10">Fokus 50 / 10</option><option value="custom">Benutzerdefiniert</option>
  </select></label>{strategy.mode === 'custom' && <div className="strategy-custom">
    <label>Fokusblock in Minuten<input type="number" min={10} max={120} required value={strategy.focusMinutes} onChange={e => onChange({ ...strategy, focusMinutes: Number(e.target.value) })} /></label>
    <label>Pause in Minuten<input type="number" min={1} max={60} required value={strategy.breakMinutes} onChange={e => onChange({ ...strategy, breakMinutes: Number(e.target.value) })} /></label>
  </div>}{validFocusStrategy(strategy) ? <p className="field-hint">{minutes} Min Fokus · {summary.count} Fokusblöcke · {summary.breaks} Pausen ({summary.pauseMinutes} Min zusätzlich). Geplant mit Pausen: {summary.totalMinutes} Min. Jeder Block startet bewusst.</p> : <p className="field-hint">Bitte wähle 10–120 Fokusminuten und 1–60 Pausenminuten.</p>}</div>
}
