import { useEffect, useRef, useState } from 'react'
import LearningContextFields from './LearningContextFields'
import { environmentOptions, purposeOptions, materialOptions } from '../../shared/learningContext.mjs'
import { readProject, readProjectInput, MAX_PHASES, MAX_MILESTONES, MAX_PROJECTS, type ProjectInput, type LongTermProject, type LongTermRoadmap } from '../../shared/longTermProjectSchema.mjs'
import { createProject, generateProjectRoadmap, loadProjects, saveProject, projectId, reorder } from '../services/longTermProjects'
const levels = [['beginner','Anfänger'],['basic','Grundkenntnisse'],['advanced','Fortgeschritten'],['custom','Eigene Beschreibung']] as const
const statuses = [['active','Aktiv'],['paused','Pausiert'],['completed','Abgeschlossen'],['archived','Archiviert']] as const
const emptyInput:ProjectInput={title:'',goal:'',startingLevel:{type:'beginner'},duration:{type:'fixed-days',days:30},weeklyMinutes:120,daysPerWeek:null,learningContext:{}}
function durationLabel(d:ProjectInput['duration']) {return d.type === 'fixed-days' ? d.days+' Tage' : d.type === 'date' ? 'Bis '+d.targetDate : 'Ohne Enddatum'}
export default function LongTermProjects({enabled,onBusy}:{enabled:boolean;onBusy?:(busy:boolean)=>void}) {
 const [loaded]=useState(()=>loadProjects())
 const [projects,setProjects]=useState<LongTermProject[]>(loaded.projects)
 const [selected,setSelected]=useState<string|null>(null)
 const [draft,setDraft]=useState<ProjectInput>(structuredClone(emptyInput))
 const [editing,setEditing]=useState<LongTermProject|null>(null)
 const [step,setStep]=useState<number|null>(null)
 const [notice,setNotice]=useState(loaded.damaged ? 'Projektspeicher beschädigt. Die Daten wurden nicht überschrieben.' : loaded.rejected ? loaded.rejected+' beschädigte Projekte wurden beim Laden ausgelassen.' : '')
 const [busy,setBusy]=useState(false)
 const available=useRef(enabled); available.current=enabled
 const alive=useRef(true)
 useEffect(()=>{alive.current=true; return()=>{alive.current=false}},[])
 const current=projects.find(p=>p.id===selected)
 const disabled=!enabled || busy || loaded.damaged
 function patch(p:Partial<ProjectInput>) {setDraft(d=>({...d,...p}))}
 function start() {setEditing(null);setSelected(null);setDraft(structuredClone(emptyInput));setStep(0);setNotice('')}
 function edit(p:LongTermProject) {setEditing(structuredClone(p));setDraft({title:p.title,goal:p.goal,startingLevel:structuredClone(p.startingLevel),duration:structuredClone(p.duration),weeklyMinutes:p.weeklyMinutes,daysPerWeek:p.daysPerWeek,learningContext:structuredClone(p.learningContext)});setStep(0);setNotice('')}
 function store(p:LongTermProject) {
  if(!available.current) return
  try {setProjects(saveProject(p));setSelected(p.id);setStep(null);setEditing(null);setNotice('Projekt lokal gespeichert.')} catch(e) {setNotice(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')}
 }
 async function submit() {
  if(disabled) return
  try {
   const sameDate=editing?.duration.type === 'date' && draft.duration.type === 'date' && editing.duration.targetDate === draft.duration.targetDate
   const safe=readProjectInput(draft,sameDate ? editing.createdAt.slice(0,10) : undefined)
   if(editing) {store(readProject({...editing,...safe,updatedAt:new Date().toISOString()}));return}
   setBusy(true);onBusy?.(true)
   const result=await generateProjectRoadmap(safe)
   if(!alive.current || !available.current) return
   const project=createProject(safe,result.roadmap)
   setProjects(saveProject(project));setSelected(project.id);setStep(null);setNotice(result.notice)
  } catch(e) {if(alive.current) setNotice(e instanceof Error ? e.message : 'Erstellen fehlgeschlagen.')}
  finally {if(alive.current) setBusy(false);onBusy?.(false)}
 }
 function roadmap(change:(r:LongTermRoadmap)=>LongTermRoadmap) {setEditing(p=>p ? {...p,roadmap:change(p.roadmap)} : p)}
 function next() {
  if(step === 0 && (!draft.title.trim() || !draft.goal.trim())) {setNotice('Bitte gib Titel und Ziel an.');return}
  if(step === 1 && draft.startingLevel.type==='custom' && !draft.startingLevel.description?.trim()) {setNotice('Bitte beschreibe deine Ausgangslage.');return}
  setNotice('');setStep(s=>Math.min(2,(s ?? 0)+1))
 }
 return <section className="projects-panel" aria-labelledby="projects-title">
  <header><p className="section-kicker">Langfristiger Lernweg</p><h2 id="projects-title">Langzeitprojekte</h2><p>Zusätzlich zu deinen schnellen Missionen: bearbeitbare Phasen und Meilensteine, lokal gespeichert.</p>
   {step===null && <button type="button" className="primary-button" disabled={disabled || projects.length>=MAX_PROJECTS} onClick={start}>Langzeitprojekt erstellen</button>}
  </header>
  {notice && <p role={enabled ? "status" : undefined}>{notice}</p>}
  {step===null && <><ul className="project-list">{projects.map(p=><li key={p.id}><button type="button" className="focus-leave" aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}>{p.title} · {statuses.find(([s])=>s===p.status)?.[1]}</button></li>)}</ul>
   {current && <article className="project-detail"><h3>{current.title}</h3><p>{current.goal}</p><dl><dt>Ausgangslage</dt><dd>{levels.find(([s])=>s===current.startingLevel.type)?.[1]} {current.startingLevel.description}</dd>{current.startingLevel.priorKnowledge && <><dt>Was du schon kannst</dt><dd>{current.startingLevel.priorKnowledge}</dd></>}<dt>Zeithorizont</dt><dd>{durationLabel(current.duration)}</dd><dt>Wochenzeit</dt><dd>{current.weeklyMinutes} Minuten</dd><dt>Lerntage (ungefähr)</dt><dd>{current.daysPerWeek ?? 'Keine Angabe'}</dd><dt>Lernkontext</dt><dd>{[environmentOptions.find(([k])=>k===current.learningContext.environment)?.[1],purposeOptions.find(([k])=>k===current.learningContext.purpose)?.[1],...(current.learningContext.materials ?? []).map(k=>materialOptions.find(([id])=>id===k)?.[1]),current.learningContext.materialsDetails].filter(Boolean).join(' · ') || 'Keine Angabe'}</dd></dl>
    <button type="button" className="focus-leave" disabled={disabled} onClick={()=>edit(current)}>Projekt bearbeiten</button>
    <p>Roadmap-Vorschlag · Zeitrahmen sind keine Aussage über deinen Lernfortschritt.</p><p>{current.roadmap.summary}</p>
    <ol className="project-phases">{current.roadmap.phases.map(p=><li key={p.id}><h4>{p.title}</h4>{p.expectedDuration && <p className="field-hint">Ungefähr {p.expectedDuration.value} {p.expectedDuration.type==='days' ? 'Tage' : 'Wochen'}</p>}<p>{p.description}</p><ul>{p.milestones.map(m=><li key={m.id}><strong>{m.title}</strong>{m.description && <p>{m.description}</p>}</li>)}</ul></li>)}</ol>
    {current.manualNotes && <><h4>Eigene Notizen</h4><p className="project-notes">{current.manualNotes}</p></>}
   </article>}
  </>}
  {step!==null && <form className="project-form" onSubmit={e=>{e.preventDefault();if(step<2)next();else void submit()}}><fieldset disabled={disabled}><legend>{editing ? 'Projekt bearbeiten' : 'Neues Langzeitprojekt'} · Schritt {step+1} von 3</legend>
   {step===0 && <><label>Projekttitel<input required maxLength={90} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label><label>Dein langfristiges Ziel<textarea required maxLength={280} value={draft.goal} onChange={e=>patch({goal:e.target.value})}/></label></>}
   {step===1 && <><label>Vorwissen<select value={draft.startingLevel.type} onChange={e=>patch({startingLevel:{...draft.startingLevel,type:e.target.value as ProjectInput['startingLevel']['type'],description:undefined}})}>{levels.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    {draft.startingLevel.type==='custom' && <label>Eigene Ausgangslage (max. 300 Zeichen)<textarea required maxLength={300} value={draft.startingLevel.description ?? ''} onChange={e=>patch({startingLevel:{...draft.startingLevel,description:e.target.value}})}/></label>}
    <label>Was kannst du schon? (optional, max. 400 Zeichen)<textarea maxLength={400} value={draft.startingLevel.priorKnowledge ?? ''} onChange={e=>patch({startingLevel:{...draft.startingLevel,priorKnowledge:e.target.value}})}/></label><LearningContextFields value={draft.learningContext} onChange={learningContext=>patch({learningContext})}/></>}
   {step===2 && <><label>Zeithorizont<select value={draft.duration.type==='fixed-days' ? String(draft.duration.days) : draft.duration.type} onChange={e=>patch({duration:e.target.value==='date' ? {type:'date',targetDate:new Date().toISOString().slice(0,10)} : e.target.value==='open-ended' ? {type:'open-ended'} : {type:'fixed-days',days:Number(e.target.value)}})}>{[10,30,100,300].map(d=><option key={d} value={d}>{d} Tage</option>)}<option value="date">Eigenes Enddatum</option><option value="open-ended">Ohne Enddatum</option></select></label>
    {draft.duration.type==='date' && <label>Enddatum<input type="date" required min={editing?.createdAt.slice(0,10) ?? new Date().toISOString().slice(0,10)} value={draft.duration.targetDate} onChange={e=>patch({duration:{type:'date',targetDate:e.target.value}})}/></label>}
    <label>Wie viel Zeit kannst du durchschnittlich pro Woche investieren?<select value={[60,120,300,600].includes(draft.weeklyMinutes) ? draft.weeklyMinutes : 'custom'} onChange={e=>patch({weeklyMinutes:e.target.value==='custom' ? 150 : Number(e.target.value)})}>{[1,2,5,10].map(h=><option key={h} value={h*60}>{h} {h===1 ? 'Stunde' : 'Stunden'}</option>)}<option value="custom">Eigener Wert</option></select></label>
    <label>Wochenzeit in Minuten (30–4.200)<input type="number" required min={30} max={4200} step={1} value={draft.weeklyMinutes} onChange={e=>patch({weeklyMinutes:Number(e.target.value)})}/></label>
    <label>An wie vielen Tagen pro Woche möchtest du ungefähr lernen?<select value={draft.daysPerWeek ?? ''} onChange={e=>patch({daysPerWeek:e.target.value ? Number(e.target.value) : null})}><option value="">Keine Angabe</option>{[1,2,3,4,5,6,7].map(d=><option key={d} value={d}>{d}</option>)}</select></label><p className="field-hint">Planungsinformation, keine Verpflichtung. Die Roadmap ist ein Vorschlag. Eingaben werden zur KI-Planung an den Server und bei externer KI an den Anbieter gesendet.</p>
    {editing && <><label>Projektstatus<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as LongTermProject['status']})}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Eigene Notizen<textarea maxLength={2000} value={editing.manualNotes} onChange={e=>setEditing({...editing,manualNotes:e.target.value})}/></label>
     <details><summary>Roadmap bearbeiten</summary><label>Zusammenfassung<textarea maxLength={400} required value={editing.roadmap.summary} onChange={e=>roadmap(r=>({...r,summary:e.target.value}))}/></label>
      {editing.roadmap.phases.map((p,i)=><details key={p.id} className="project-phase-editor" open={i===0}><summary>Phase {i+1}: {p.title}</summary><fieldset><legend>Phase {i+1}</legend><label>Phasentitel<input required maxLength={90} value={p.title} onChange={e=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,title:e.target.value} : v)}))}/></label><label>Phasenbeschreibung<textarea maxLength={300} value={p.description} onChange={e=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,description:e.target.value} : v)}))}/></label>
       <div className="project-actions"><button type="button" disabled={i===0} onClick={()=>roadmap(r=>({...r,phases:reorder(r.phases,i,-1)}))}>Phase nach oben</button><button type="button" disabled={i===editing.roadmap.phases.length-1} onClick={()=>roadmap(r=>({...r,phases:reorder(r.phases,i,1)}))}>Phase nach unten</button></div>
       {p.milestones.map((m,j)=><fieldset key={m.id}><legend>Meilenstein {j+1}</legend><label>Meilensteintitel<input required maxLength={90} value={m.title} onChange={e=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:v.milestones.map(w=>w.id===m.id ? {...w,title:e.target.value} : w)} : v)}))}/></label><label>Meilensteinbeschreibung<textarea maxLength={200} value={m.description ?? ''} onChange={e=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:v.milestones.map(w=>w.id===m.id ? {...w,description:e.target.value} : w)} : v)}))}/></label>
        <div className="project-actions"><button type="button" disabled={j===0} onClick={()=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:reorder(v.milestones,j,-1)} : v)}))}>Meilenstein nach oben</button><button type="button" disabled={j===p.milestones.length-1} onClick={()=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:reorder(v.milestones,j,1)} : v)}))}>Meilenstein nach unten</button><button type="button" disabled={p.milestones.length<=1} onClick={()=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:v.milestones.filter(w=>w.id!==m.id).map((w,order)=>({...w,order}))} : v)}))}>Meilenstein löschen</button></div>
       </fieldset>)}
       <button type="button" disabled={p.milestones.length>=MAX_MILESTONES} onClick={()=>roadmap(r=>({...r,phases:r.phases.map(v=>v.id===p.id ? {...v,milestones:[...v.milestones,{id:projectId(),title:'Neuer Meilenstein',order:v.milestones.length}]} : v)}))}>Meilenstein hinzufügen</button>
      </fieldset></details>)}<p className="field-hint">Maximal {MAX_PHASES} Phasen und {MAX_MILESTONES} Meilensteine je Phase. Manuelle Änderungen benötigen keine KI.</p>
     </details></>}
   </>}
   <div className="project-actions">{step>0 && <button type="button" onClick={()=>setStep(step-1)}>Zurück</button>}<button type="submit" className="primary-button">{busy ? 'Roadmap wird erstellt …' : step<2 ? 'Weiter' : editing ? 'Projekt speichern' : 'Roadmap erstellen und speichern'}</button><button type="button" onClick={()=>{setStep(null);setEditing(null)}}>Abbrechen</button></div>
  </fieldset></form>}
 </section>
}
