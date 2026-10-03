import type { SessionHistoryEntry } from '../services/learningHistory'

export default function LearningHistory({ entries }: { entries: SessionHistoryEntry[] }) {
  return <details className="learning-history"><summary>Deine letzten Missionen</summary>
    {entries.length === 0 ? <p>Noch keine beendete Fokus-Session. Deine erste Mission erscheint hier nach dem Abschluss.</p>
      : <ol>{entries.map(entry => <li key={entry.id}>
        <time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</time>
        <strong>{entry.goal}</strong>
        <span>{Math.floor(entry.focusSeconds / 60)} min {Math.floor(entry.focusSeconds % 60)} s Fokus · {entry.completedSteps} von {entry.totalSteps} erledigt</span>
        <span>{entry.status === 'completed' ? 'Abgeschlossen' : 'Vorzeitig beendet'}</span>
      </li>)}</ol>}
  </details>
}
