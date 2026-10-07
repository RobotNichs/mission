import { useEffect, useRef, useState } from 'react'
import type { LearningPlan } from '../types/learningPlan'
import PlanEditor from './PlanEditor'
import { categories, deleteTemplate, duplicateTemplate, exampleTemplates, exportTemplate, findTemplates, importTemplate, loadTemplates, MAX_IMPORT_BYTES, missionFromTemplate, saveTemplate, templateFilename, templateFromPlan, TEMPLATE_STORAGE_KEY, type MissionTemplate, type TemplateMetadata } from '../services/missionTemplates'

type Props = { saveRequest: LearningPlan | null; onDismissSave: () => void; onUse: (plan: LearningPlan) => void; enabled: boolean; sessionActive: boolean; suggestedOrigin?: 'custom' | 'ai'; active?: boolean }
export default function MissionLibrary({ saveRequest, onDismissSave, onUse, enabled, sessionActive, suggestedOrigin = 'custom', active }: Props) {
  const [items, setItems] = useState<MissionTemplate[]>([]), [error, setError] = useState('')
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [language, setLanguage] = useState(''), [category, setCategory] = useState(''), [origin, setOrigin] = useState(''), [sort, setSort] = useState('updated')
  useEffect(() => { if (active) setOpen(true) }, [active])
  const [editing, setEditing] = useState<{ plan: LearningPlan; previous?: MissionTemplate } | null>(null)
  const [metadata, setMetadata] = useState<TemplateMetadata>({ title: '', description: '', language: 'de', category: 'Sonstiges', tags: [], origin: 'custom' })
  const [tags, setTags] = useState('')
  const panel = useRef<HTMLDetailsElement>(null), nameInput = useRef<HTMLInputElement>(null), saved = useRef(false)
  const writable = useRef(enabled)
  writable.current = enabled
  function refresh() { try { setItems(loadTemplates()); setError('') } catch { setError('Die gespeicherte Bibliothek ist beschädigt oder hat eine unbekannte Version. Sie wird nicht überschrieben.') } }
  useEffect(() => { refresh(); const listener = (e: StorageEvent) => { if (e.key === TEMPLATE_STORAGE_KEY) refresh() }; window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener) }, [])
  useEffect(() => {
    if (!saveRequest) return
    setOpen(true); saved.current = false
    setEditing({ plan: { ...saveRequest, steps: saveRequest.steps.map(s => ({ ...s, done: false })) } })
    setMetadata({ title: saveRequest.goal.slice(0, 90), description: '', language: 'de', category: 'Sonstiges', tags: [], origin: suggestedOrigin }); setTags('')
  // A suggestion initializes a new save draft; later mission changes must not overwrite it.
  }, [saveRequest])
  useEffect(() => { if (editing) { nameInput.current?.focus(); panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' }) } }, [editing])
  function run(action: () => void) { if (!writable.current) return; try { action(); setError('') } catch (e) { setError(e instanceof Error && e.message.startsWith('Maximal') ? e.message : 'Aktion nicht möglich. Prüfe Datei, Eingaben und lokalen Speicher. Bestehende Daten bleiben erhalten.') } }
  function cancel() { setEditing(null); onDismissSave(); panel.current?.querySelector('summary')?.focus() }
  function edit(t: MissionTemplate) {
    saved.current = false; setEditing({ plan: missionFromTemplate(t), previous: t.origin === 'example' ? undefined : t })
    setMetadata({ ...t, origin: t.origin === 'example' ? 'custom' : t.origin }); setTags(t.tags.join(', '))
  }
  const shown = findTemplates([...exampleTemplates, ...items], query, language, category, origin, sort)
  return <details ref={panel} className="mission-library panel" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Missionsbibliothek <small>{items.length} eigene · 5 Beispiele</small></summary>
    <div className="library-content">
      <p>Wiederverwendbare Pläne, lokal auf diesem Gerät. „Mission starten“ übernimmt den Plan mit pausiertem Timer.</p>
      {sessionActive && <p role="status">Beende zuerst deine fortsetzbare Session, bevor du eine neue Mission übernimmst.</p>}
      {error && <p role="alert">{error}</p>}
      {editing && <section aria-label="Vorlage bearbeiten">
        <h3>{editing.previous ? 'Vorlage aktualisieren' : 'Als Vorlage speichern'}</h3>
        <fieldset disabled={!enabled} className="library-metadata">
          <label>Name<input ref={nameInput} value={metadata.title} maxLength={90} onChange={e => setMetadata(m => ({ ...m, title: e.target.value }))} /></label>
          <label>Kurzbeschreibung<textarea value={metadata.description} maxLength={600} onChange={e => setMetadata(m => ({ ...m, description: e.target.value }))} /></label>
          <label>Sprache<select value={metadata.language} onChange={e => setMetadata(m => ({ ...m, language: e.target.value as TemplateMetadata['language'] }))}><option value="de">Deutsch</option><option value="en">Englisch</option><option value="other">Sonstige / nicht festgelegt</option></select></label>
          <label>Kategorie<select value={metadata.category} onChange={e => setMetadata(m => ({ ...m, category: e.target.value as TemplateMetadata['category'] }))}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Tags (Komma getrennt, höchstens 8)<input value={tags} maxLength={200} onChange={e => setTags(e.target.value)} /></label>
          <label>Herkunft<select value={metadata.origin} onChange={e => setMetadata(m => ({ ...m, origin: e.target.value as TemplateMetadata['origin'] }))}><option value="custom">Eigener Plan</option><option value="ai">KI-Vorschlag</option><option value="imported">Importiert</option></select></label>
        </fieldset>
        <p>Sprache und Herkunft bitte prüfen. Änderungen hier betreffen nur die Vorlage, nicht deine aktive Mission.</p>
        <PlanEditor key={editing.plan.id} initial={editing.plan} disabled={!enabled} saveLabel={editing.previous ? 'Vorlage aktualisieren' : 'Vorlage speichern'} onCancel={cancel} onSave={plan => run(() => {
          if (saved.current) return
          const t = templateFromPlan(plan, { title: metadata.title, description: metadata.description, language: metadata.language, category: metadata.category, origin: metadata.origin, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }, editing.previous)
          setItems(saveTemplate(t)); saved.current = true; cancel()
        })} />
      </section>}
      <div className="library-filters">
        <label>Suchen<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Titel, Lernziel oder Tag" /></label>
        <label>Sprachfilter<select value={language} onChange={e => setLanguage(e.target.value)}><option value="">Alle Sprachen</option><option value="de">Deutsch</option><option value="en">Englisch</option><option value="other">Sonstige</option></select></label>
        <label>Kategorienfilter<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Alle Kategorien</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Herkunftsfilter<select value={origin} onChange={e => setOrigin(e.target.value)}><option value="">Alle Herkünfte</option><option value="custom">Eigene</option><option value="ai">KI</option><option value="example">Beispiele</option><option value="imported">Importiert</option></select></label>
        <label>Sortieren<select value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Zuletzt geändert</option><option value="name">Name</option><option value="duration">Dauer</option></select></label>
        <label>JSON-Vorlage importieren<input type="file" accept=".json,application/json" disabled={!enabled} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file || !enabled) return
          if (file.size > MAX_IMPORT_BYTES) { setError('Die Datei darf höchstens 256 KiB groß sein.'); return }
          try { const raw = await file.text(); run(() => setItems(saveTemplate(importTemplate(raw)))) } catch { setError('Die Datei konnte nicht gelesen werden.') }
        }} /></label>
      </div>
      <ul className="library-list">{shown.map(t => <li key={t.id}>
        <h3>{t.title}</h3><p>{t.goal}</p><small>{t.category} · {{ de: 'Deutsch', en: 'Englisch', other: 'Sonstige' }[t.language]} · {{ custom: 'Eigener Plan', ai: 'KI-Vorschlag', example: 'Beispiel', imported: 'Importiert' }[t.origin]} · {t.plannedMinutes === null ? 'Stoppuhr' : `${t.plannedMinutes} min`} · {t.steps.length} Schritte</small>
        {t.description && <p>{t.description}</p>}{t.tags.length > 0 && <p className="library-tags">{t.tags.join(' · ')}</p>}
        <div className="library-actions">
          <button type="button" disabled={!enabled || sessionActive} onClick={() => run(() => onUse(missionFromTemplate(t)))}>Mission starten</button>
          <button type="button" disabled={!enabled} onClick={() => edit(t)}>Bearbeiten</button>
          <button type="button" disabled={!enabled} onClick={() => run(() => setItems(saveTemplate(duplicateTemplate(t))))}>Duplizieren</button>
          <button type="button" onClick={() => run(() => {
            const url = URL.createObjectURL(new Blob([exportTemplate(t)], { type: 'application/json' })), link = document.createElement('a')
            link.href = url; link.download = templateFilename(t); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
          })}>Exportieren</button>
          {t.origin !== 'example' && <button type="button" disabled={!enabled} onClick={() => { if (window.confirm('Diese Vorlage löschen? Deine aktive Mission bleibt erhalten.')) run(() => setItems(deleteTemplate(t.id))) }}>Löschen</button>}
        </div>
      </li>)}</ul>
      {!shown.length && <p>Keine Vorlagen für diese Auswahl.</p>}
    </div>
  </details>
}
