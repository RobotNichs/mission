import { useEffect, useState } from 'react'
import { formatFocusDuration, goalProgress, statisticsOverview, validGoals, type LearningStatistics as Statistics, type StatisticsGoals } from '../services/learningStatistics'

export default function LearningStatistics({ statistics, total, canWrite, onGoals }: {
  statistics: Statistics; total: number; canWrite: boolean; onGoals: (goals: StatisticsGoals) => void
}) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [daily, setDaily] = useState(statistics.goals.dailyMinutes)
  const [weekly, setWeekly] = useState(statistics.goals.weeklyMinutes)
  const [error, setError] = useState('')
  useEffect(() => { setDaily(statistics.goals.dailyMinutes); setWeekly(statistics.goals.weeklyMinutes) }, [statistics.goals])
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const refresh = () => {
      setNow(Date.now())
      clearTimeout(timeout)
      const d = new Date()
      timeout = setTimeout(refresh, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - Date.now() + 20)
    }
    refresh(); document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timeout); document.removeEventListener('visibilitychange', refresh) }
  }, [statistics])
  const view = statisticsOverview(statistics, total, now)
  const maximum = Math.max(60000, ...view.sevenDays.map(d => d.focusMilliseconds))
  function save() {
    const goals = { dailyMinutes: daily, weeklyMinutes: weekly }
    if (!validGoals(goals)) { setError('Tagesziel: 10–720 Minuten. Wochenziel: 30–10.080 Minuten. Bitte ganze Zahlen verwenden.'); return }
    setError(''); onGoals(goals)
  }
  function goal(label: string, ms: number, minutes: number | null) {
    const progress = goalProgress(ms, minutes)
    return <div className="statistics-goal"><strong>{label}</strong>{progress ? <>
      <span>{formatFocusDuration(ms)} / {formatFocusDuration(minutes! * 60000)}{progress.reached ? ' · Ziel erreicht' : ` · Noch ${formatFocusDuration(progress.remainingMilliseconds)}`}</span>
      <progress aria-label={label} max={1} value={progress.fraction} />
    </> : <span>Kein Ziel festgelegt</span>}</div>
  }
  return <details className="learning-statistics" open={open}>
    <summary onClick={e => { e.preventDefault(); setOpen(!open) }}>Dein Lernfortschritt</summary>
    {open && <div className="statistics-content">
      <dl className="statistics-totals">{[['Heute', view.todayMilliseconds], ['Diese Woche', view.weekMilliseconds], ['Letzte 7 Tage', view.lastSevenMilliseconds], ['Gesamt', view.totalMilliseconds]].map(([label, ms]) => <div key={label}><dt>{label}</dt><dd>{formatFocusDuration(Number(ms))}</dd></div>)}</dl>
      <p>Kalenderwoche: Montag bis Sonntag, lokale Zeit. Pausen zählen nicht.</p>
      <div className="statistics-goals">{goal('Tagesziel', view.todayMilliseconds, statistics.goals.dailyMinutes)}{goal('Wochenziel', view.weekMilliseconds, statistics.goals.weeklyMinutes)}</div>
      <h3>Die letzten sieben Kalendertage</h3>
      <ol className="statistics-days">{view.sevenDays.map(day => <li key={day.key}>
        <span className="statistics-bar" aria-hidden="true"><span style={{ height: `${day.focusMilliseconds / maximum * 100}%` }} /></span>
        <time dateTime={day.key}>{new Date(day.time).toLocaleDateString('de-DE', { weekday: 'short' })}</time>
        <small>{new Date(day.time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</small>
        <span>{Math.floor(day.focusMilliseconds / 60000)} min</span>
      </li>)}</ol>
      <p>{statistics.completedSessions} abgeschlossene · {statistics.endedEarlySessions} vorzeitig beendete Sessions seit Beginn der Statistikerfassung.</p>
      <p className="statistics-note">Tageswerte werden seit {new Date(statistics.trackedSince).toLocaleDateString('de-DE')} erfasst und 400 Tage aufbewahrt. Frühere Fokuszeit bleibt unter „Gesamt“ erhalten.</p>
      <fieldset disabled={!canWrite} className="statistics-settings"><legend>Optionale Ziele</legend>
        <label><input type="checkbox" checked={daily !== null} onChange={e => setDaily(e.target.checked ? 60 : null)} /> Tagesziel aktivieren</label>
        {daily !== null && <label>Tagesziel in Minuten<input type="number" min={10} max={720} step={1} value={daily} onChange={e => setDaily(Number(e.target.value))} /></label>}
        <label><input type="checkbox" checked={weekly !== null} onChange={e => setWeekly(e.target.checked ? 300 : null)} /> Wochenziel aktivieren</label>
        {weekly !== null && <label>Wochenziel in Minuten<input type="number" min={30} max={10080} step={1} value={weekly} onChange={e => setWeekly(Number(e.target.value))} /></label>}
        <button type="button" onClick={save}>Ziele speichern</button>
        <small>Ziele vergeben keine zusätzlichen Belohnungen. Es gibt keine Strafen.</small>
      </fieldset>{error && <p role="alert">{error}</p>}
    </div>}
  </details>
}
