import type { SessionHistoryEntry } from '../services/learningHistory'
import { strategyLabel } from '../services/focusBlocks'

export default function LearningHistory({ entries, reviewableIds = [], onReview }: { entries: SessionHistoryEntry[]; reviewableIds?: string[]; onReview?: (entry: SessionHistoryEntry) => void }) {
  return <details className="learning-history"><summary>Deine letzten Missionen</summary>
    {entries.length === 0 ? <p>Noch keine beendete Fokus-Session. Deine erste Mission erscheint hier nach dem Abschluss.</p>
      : <ol>{entries.map(entry => <li key={entry.id}>
        <time dateTime={entry.endedAt}>{new Date(entry.endedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</time>
        <strong>{entry.goal}</strong>
        <span>{Math.floor(entry.focusSeconds / 60)} min {Math.floor(entry.focusSeconds % 60)} s Fokus · {entry.completedSteps} von {entry.totalSteps} erledigt</span>
        <span>{entry.status === 'completed' ? 'Abgeschlossen' : 'Vorzeitig beendet'}</span>
        {entry.projectReview?.status === 'skipped' && reviewableIds.includes(entry.id) && onReview && <button type="button" onClick={()=>onReview(entry)}>Projekt-Review erneut öffnen</button>}
        {entry.projectReview?.status === 'applied' && <span>Projektfortschritt übernommen</span>}
        {entry.focusStrategy && <span>{strategyLabel(entry.focusStrategy)} · {entry.completedFocusBlocks ?? 0} Fokusblöcke abgeschlossen · {Math.floor((entry.breakSeconds ?? 0) / 60)} min Pause</span>}
      </li>)}</ol>}
  </details>
}
