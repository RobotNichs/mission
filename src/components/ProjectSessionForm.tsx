import { useState } from 'react'
import { learningBlockerOptions, type EnergyLevel, type LearningBlocker } from '../types/learningPlan'
import FocusStrategyFields from './FocusStrategyFields'
import type { FocusStrategy } from '../services/focusBlocks'
import type { ProjectSessionInput } from '../services/projectMission'
export default function ProjectSessionForm({enabled,onCreate,onCancel}:{enabled:boolean;onCreate:(input:ProjectSessionInput)=>Promise<boolean>;onCancel:()=>void}) {
 const [minutes,setMinutes]=useState(30), [energy,setEnergy]=useState<EnergyLevel>('medium'), [blocker,setBlocker]=useState<LearningBlocker|null>(null)
 const [details,setDetails]=useState(''), [strategy,setStrategy]=useState<FocusStrategy>({mode:'free'}), [busy,setBusy]=useState(false), [notice,setNotice]=useState('')
 return <form className="project-form" aria-label="Tagesmission planen" onSubmit={async e=>{e.preventDefault();if(!enabled || busy)return;setBusy(true);setNotice('');try{await onCreate({timeBudgetMinutes:minutes,energyLevel:energy,learningBlocker:blocker,...(blocker==='other' ? {learningBlockerDetails:details} : {}),focusStrategy:strategy})}catch(e){setNotice(e instanceof Error ? e.message : 'Die Projektmission konnte nicht erstellt werden.')}finally{setBusy(false)}}}>
  <fieldset disabled={!enabled || busy}><legend>Heutige Mission</legend><p>Wir verwenden deine aktuelle Projektphase und offenen Meilensteine. Du planst nur diese Session.</p>
   <label>Heute verfügbare Zeit<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{Array.from({length:12},(_,i)=>(i+1)*5).map(m=><option key={m} value={m}>{m} Minuten</option>)}</select></label>
   <label>Energielevel<select value={energy} onChange={e=>setEnergy(e.target.value as EnergyLevel)}><option value="low">Niedrig</option><option value="medium">Ausgeglichen</option><option value="high">Hoch</option></select></label>
   <label>Lernblocker<select value={blocker ?? ''} onChange={e=>setBlocker(e.target.value as LearningBlocker || null)}><option value="">Kein besonderer Blocker</option>{learningBlockerOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
   {blocker==='other' && <label>Was erschwert dir heute das Lernen? (optional)<textarea maxLength={240} value={details} onChange={e=>setDetails(e.target.value)}/></label>}
   <details><summary>Fokusstrategie (optional)</summary><FocusStrategyFields value={strategy} onChange={setStrategy} minutes={minutes}/></details>
   <p className="field-hint">Die kompakten Projektangaben und heutigen Eingaben werden zur Planung an den Server und bei externer KI an den Anbieter gesendet. Der neue Lernplan startet mit pausiertem Timer.</p>
   <div className="project-actions"><button className="primary-button" type="submit">{busy ? 'Tagesmission wird erstellt …' : 'Tagesmission erstellen'}</button><button type="button" onClick={onCancel}>Abbrechen</button></div>
  </fieldset>{notice && <p role="alert">{notice}</p>}
 </form>
}
