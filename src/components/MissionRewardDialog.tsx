type MissionRewardDialogProps = { onClose: () => void }

export default function MissionRewardDialog({ onClose }: MissionRewardDialogProps) {
  return (
    <div className="reward-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="reward-modal-title"
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
        <button className="reward-modal-close" type="button" aria-label="Belohnung schließen" onClick={onClose} autoFocus>×</button>
        <p className="section-kicker">MISSION ABGESCHLOSSEN</p>
        <h2 id="reward-modal-title">Starker Abschluss.</h2>
        <p className="reward-modal-copy">Alle Schritte erledigt. Deine Fokuszeit zählt weiter für Level und Coins.</p>
        <button className="reward-modal-action" type="button" onClick={onClose}>Weiterlernen</button>
      </section>
    </div>
  )
}
