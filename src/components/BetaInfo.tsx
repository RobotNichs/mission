import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, replaceLocalData, type Backup } from '../services/localBackup'

export default function BetaInfo({ enabled, onClose, reload = () => location.reload() }: { enabled: boolean; onClose: () => void; reload?: () => void }) {
  const panel = useRef<HTMLElement>(null)
  const close = useRef(onClose); close.current = onClose
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<Backup | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const fileSequence = useRef(0)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = Array.from(document.body.children).filter(e => !e.contains(panel.current)) as HTMLElement[]
    const old = siblings.map(e => ({ e, inert: e.inert, hidden: e.getAttribute('aria-hidden') }))
    old.forEach(({ e }) => { e.inert = true; e.setAttribute('aria-hidden', 'true') })
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const controls = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])
    controls()[0]?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current() }
      if (e.key === 'Tab') { const list = controls(); const first = list[0], last = list.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } }
    }
    const focus = (e: FocusEvent) => { if (e.target instanceof Node && !panel.current?.contains(e.target)) controls()[0]?.focus() }
    document.addEventListener('keydown', key); document.addEventListener('focusin', focus)
    return () => { fileSequence.current++; document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); document.body.style.overflow = overflow; old.forEach(({ e, inert, hidden }) => { e.inert = inert; if (hidden === null) e.removeAttribute('aria-hidden'); else e.setAttribute('aria-hidden', hidden) }); if (previous?.isConnected) previous.focus() }
  }, [])
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = `mission-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Backup heruntergeladen. Bewahre die Datei privat auf: Sie enthält deine Lerntexte.')
    } catch { setNotice('Backup konnte nicht erstellt werden. Deine gespeicherten Daten wurden nicht verändert.') }
  }
  async function readFile(file?: File) {
    const sequence = ++fileSequence.current; setPending(null); setNotice('')
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('size')
      const backup = parseBackup(await file.text())
      if (sequence === fileSequence.current) setPending(backup)
    } catch { if (sequence === fileSequence.current) setNotice('Ungültiges Backup: Nur Mission-Backups der Version 1 bis 2 MiB sind erlaubt. Es wurde nichts übernommen.') }
  }
  function confirm() {
    if (!pending || !enabled || busy) return
    setBusy(true)
    try { replaceLocalData(pending === 'delete' ? null : pending, true); reload() } catch (e) { setNotice(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); setBusy(false) }
  }
  return createPortal(<div className="shop-modal-backdrop collection-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="beta-info-title" className="shop-confirm-modal collection-dialog">
      <header className="collection-dialog-header"><h2 id="beta-info-title">Mission · Info & Daten</h2><button type="button" className="focus-leave" onClick={onClose} disabled={busy}>Schließen</button></header>
      <div className="collection-dialog-scroll beta-info">
        <p className="section-kicker">Beta · Funktionen können sich noch ändern</p>
        <h3>Was ist Mission?</h3><p>Mission hilft dir, Lernen in kleine Schritte zu zerlegen und konzentriert anzufangen. KI-Pläne sind bearbeitbare Vorschläge, keine fachlich geprüften Lösungen.</p>
        <h3>Datenschutz & lokale Daten</h3><p>Lernpläne, Fortschritt, Coins, Orbs, Statistik, Ziele, Vorlagen, Lernkontext und Historie liegen lokal in deinem Browser. Sie werden nicht automatisch mit anderen Geräten synchronisiert. Beim Löschen von Browserdaten können sie verloren gehen.</p>
        <p>KI-bezogene Eingaben einschließlich Antworten und Lernkontext werden an den Mission-Server und bei externer KI an den konfigurierten AI-Anbieter gesendet. Der Mock-Modus verwendet keinen externen KI-Dienst. Gib keine vertraulichen Informationen ein.</p>
        <p>Technische Fehlerdiagnosen enthalten Kategorien, Diagnose-ID und Laufzeit, keine vollständigen Lerntexte oder API-Schlüssel. Der Hosting-Anbieter kann eigene Verbindungslogs führen. Mission verwendet keine Werbung, Nutzerkonten, Analytics oder Cloud-Datenbank.</p>
        <h3>Installation & Offline</h3><p>Du kannst Mission über die Installationsfunktion deines Browsers als App nutzen. Nach vorherigem Laden stehen lokale Funktionen möglichst offline bereit. Externe KI benötigt Netzwerk; bei Fehlern gibt es einen lokalen Ersatzplan.</p>
        <h3>Feedback</h3><a className="focus-leave" href="mailto:vorname%40nachname%40gmail.com?subject=Mission%20Beta%20Feedback">Feedback geben</a><p>Temporärer Mock-Kanal: vorname@nachname@gmail.com ist noch keine gültige Empfängeradresse. Vor der Beta-Einladung ersetzen. Teile keine privaten Lerntexte oder Backup-Dateien öffentlich.</p>
        <h3>Deine Daten</h3><p>Backups enthalten persönliche Lerntexte. Export, Ersetzen und Löschen sind nur bei angehaltenem Timer möglich und wenn dieser Tab die Schreibsperre besitzt. Schließe vor dem Ersetzen oder Löschen andere Mission-Tabs und sichere vorher deine Daten.</p>
        <button type="button" className="focus-leave" disabled={!enabled || busy} onClick={download}>Backup herunterladen</button>
        <label>Backup importieren (max. 2 MiB)<input type="file" accept=".json,application/json" disabled={!enabled || busy} onChange={e => { void readFile(e.target.files?.[0]); e.target.value = '' }} /></label>
        <button type="button" className="focus-leave" disabled={!enabled || busy} onClick={() => { fileSequence.current++; setPending('delete') }}>Lokale Daten löschen</button>
        {pending && <div className="form-notice"><p>{pending === 'delete' ? 'Alle lokalen Mission-Daten löschen? Andere Browserdaten bleiben erhalten.' : 'Alle bisherigen lokalen Mission-Daten durch dieses Backup ersetzen? Es gibt keinen Zusammenführungsmodus.'}</p><button type="button" className="primary-button" disabled={!enabled || busy} onClick={confirm}>{pending === 'delete' ? 'Löschen bestätigen' : 'Ersetzen bestätigen'}</button><button type="button" className="focus-leave" disabled={busy} onClick={() => setPending(null)}>Abbrechen</button></div>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </section>
  </div>, document.body)
}
