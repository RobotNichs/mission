import { readProject, type LongTermProject } from '../../shared/longTermProjectSchema.mjs'
import { emptyLearningState, readLearningState, selectLearningContextState } from '../../shared/projectLearningState.mjs'
import { localReview, MAX_REVIEW_INPUT_BYTES, readReviewInput, readReviewProposal, readSessionReview, type ReviewInput, type ReviewProposal, type SessionReview } from '../../shared/projectReviewSchema.mjs'
import { loadProjects, saveProject, projectId } from './longTermProjects'
import { normalizeHistory, type SessionHistoryEntry } from './learningHistory'
import type { LearningPlan } from '../types/learningPlan'
export const MISSION_STATE_KEY='mission.saved-mission.v1'
type Store=Pick<Storage,'getItem'|'setItem'>
export type ReviewTicket={sessionId:string;projectId:string;projectRevision:string;milestoneTitles:Record<string,string>;input:ReviewInput}
function fail(message:string):never{throw new Error(message)}
function getProject(entry:SessionHistoryEntry,storage:Pick<Storage,'getItem'>) {
 const projects=loadProjects(storage)
 if(projects.damaged)fail('Der Projektspeicher ist beschädigt.')
 const p=projects.projects.find(p=>p.id===entry.sourceProject?.projectId)
 if(!p)fail('Das Projekt ist nicht mehr vorhanden oder beschädigt.')
 if(p.status==='archived')fail('Das Projekt ist archiviert. Es wurde kein Fortschritt übernommen.')
 const phase=p.roadmap.phases.find(v=>v.id===entry.sourceProject?.phaseId)
 if(!phase || (entry.sourceProject?.milestoneIds ?? []).some(id=>!phase.milestones.some(m=>m.id===id)))fail('Die referenzierte Phase oder ein Meilenstein ist nicht mehr vorhanden.')
 return {project:p,phase}
}
export function captureSessionReview(entry:SessionHistoryEntry,plan:LearningPlan|null,storage:Pick<Storage,'getItem'>=localStorage):SessionReview | undefined {
 if(!entry.sourceProject || entry.focusSeconds<=0 || !plan)return undefined
 try {getProject(entry,storage);return readSessionReview({version:1,status:'pending',steps:plan.steps.slice(0,12).map(s=>({id:s.id,title:s.title.slice(0,90),description:s.description.slice(0,200),done:s.done}))},entry.sourceProject)}catch{return undefined}
}
export function createReviewTicket(entry:SessionHistoryEntry,storage:Pick<Storage,'getItem'>=localStorage):ReviewTicket {
 if(!entry.projectReview || entry.projectReview.status==='applied')fail('Dieser Session-Review ist nicht mehr offen.')
 const {project,phase}=getProject(entry,storage)
 if(project.learningState?.recentProgress.some(p=>p.sessionId===entry.id))fail('Der Projektfortschritt wurde bereits übernommen.')
 const candidate:ReviewInput={version:1,sessionId:entry.id,projectGoal:project.goal,phase:{id:phase.id,title:phase.title},milestoneIds:entry.sourceProject?.milestoneIds ?? [],steps:entry.projectReview.steps.map(s=>({...s})),focusSeconds:entry.focusSeconds,completedSteps:entry.completedSteps,totalSteps:entry.totalSteps,...(project.learningState ? {learningState:selectLearningContextState(project.learningState,phase.title)} : {})}
 const oversized=()=>new TextEncoder().encode(JSON.stringify(candidate)).length>MAX_REVIEW_INPUT_BYTES
 if(candidate.learningState && oversized()) {
  const state=candidate.learningState
  while(oversized() && state.recentProgress.length)state.recentProgress.pop()
  for(const key of ['known','inProgress','weak'] as const)while(oversized() && state[key].length)state[key].pop()
  if(oversized())state.nextSessionNote=''
 }
 if(oversized())candidate.steps=candidate.steps.map(s=>({...s,description:''}))
 while(oversized() && candidate.steps.length>1)candidate.steps.pop()
 const input=readReviewInput(candidate)
 return {sessionId:entry.id,projectId:project.id,projectRevision:JSON.stringify(project),milestoneTitles:Object.fromEntries(phase.milestones.map(m=>[m.id,m.title])),input}
}
function readJournal(storage:Pick<Storage,'getItem'>) {
 let state:Record<string,unknown>
 try {state=JSON.parse(storage.getItem(MISSION_STATE_KEY) ?? 'null')}catch{fail('Die Session-Daten sind beschädigt.')}
 if(!state! || typeof state! !=='object' || Array.isArray(state!) || !Array.isArray(state!.history))fail('Die Session-Daten sind beschädigt.')
 const history=normalizeHistory(state!.history)
 return {state:state!,history}
}
export function saveReviewDraft(sessionId:string,draft:ReviewProposal|undefined,status:'pending'|'skipped',canWrite:boolean,storage:Store=localStorage) {
 if(!canWrite)fail('Dieser Tab besitzt die Schreibsperre nicht. Übernehmen ist gesperrt.')
 const {state,history}=readJournal(storage), entry=history.find(e=>e.id===sessionId)
 if(!entry?.sourceProject || !entry.projectReview || entry.projectReview.status==='applied')fail('Der Session-Review ist nicht mehr verfügbar.')
 const proposal=draft ? readReviewProposal(draft,entry.sourceProject.milestoneIds ?? []) : entry.projectReview.draft
 const next=history.map(e=>e.id===sessionId ? {...e,projectReview:{...e.projectReview!,status,...(proposal ? {draft:proposal} : {})}} : e)
 storage.setItem(MISSION_STATE_KEY,JSON.stringify({...state,history:next}));return next
}
export function applyProjectReview(ticket:ReviewTicket,draft:ReviewProposal,canWrite:boolean,storage:Store=localStorage) {
 if(!canWrite)fail('Dieser Tab besitzt die Schreibsperre nicht. Übernehmen ist gesperrt.')
 const {state,history}=readJournal(storage), entry=history.find(e=>e.id===ticket.sessionId)
 if(!entry?.sourceProject || !entry.projectReview || entry.projectReview.status==='applied')fail('Dieser Fortschritt wurde bereits übernommen oder die Session ist nicht mehr verfügbar.')
 const {project}=getProject(entry,storage)
 if(project.id!==ticket.projectId || project.learningState?.recentProgress.some(p=>p.sessionId===entry.id))fail('Dieser Projektfortschritt wurde bereits übernommen.')
 if(JSON.stringify(project)!==ticket.projectRevision || JSON.stringify(createReviewTicket(entry,storage).input)!==JSON.stringify(ticket.input))fail('Projekt oder Session haben sich geändert. Bitte öffne den Review erneut.')
 const proposal=readReviewProposal(draft,entry.sourceProject.milestoneIds ?? []), previous=project.learningState ?? emptyLearningState()
 const merge=(old:string[],added:string[])=>{const result=[...old];for(const value of added)if(!result.some(v=>v.toLocaleLowerCase('de')===value.toLocaleLowerCase('de')))result.push(value);if(result.length>30)fail('Maximal 30 Themen je Lernstand-Liste. Bitte reduziere die neuen Einträge.');return result}
 const changed=new Map<string,string>()
 for(const [key,list] of [['known',proposal.suggestedKnown],['inProgress',proposal.suggestedInProgress],['weak',proposal.suggestedWeak]] as const)for(const item of list){const id=item.toLocaleLowerCase('de');if(changed.has(id))fail('Bitte ordne ein neues Thema genau einer Lernstand-Liste zu.');changed.set(id,key)}
 const category=(key:'known'|'inProgress'|'weak',added:string[])=>merge(previous[key].filter(v=>!changed.has(v.toLocaleLowerCase('de')) || changed.get(v.toLocaleLowerCase('de'))===key),added)
 const now=new Date().toISOString(), learningState=readLearningState({version:1,known:category('known',proposal.suggestedKnown),inProgress:category('inProgress',proposal.suggestedInProgress),weak:category('weak',proposal.suggestedWeak),recentProgress:[{id:projectId(),sessionId:entry.id,createdAt:now,summary:proposal.sessionSummary},...previous.recentProgress].slice(0,10),nextSessionNote:proposal.nextSessionNote})
 const completions=new Set(proposal.milestoneSuggestions.filter(m=>m.suggestion==='mark-completed').map(m=>m.milestoneId))
 const updated=readProject({...project,updatedAt:now,learningState,roadmap:{...project.roadmap,phases:project.roadmap.phases.map(p=>p.id===entry.sourceProject?.phaseId ? {...p,milestones:p.milestones.map(m=>completions.has(m.id) ? {...m,status:'completed'} : m)} : p)}})
 const next=history.map(e=>e.id===entry.id ? {...e,projectReview:{...e.projectReview!,status:'applied' as const,draft:proposal,appliedAt:now}} : e)
 // The project write includes the session receipt. A crash before the history
 // write is still idempotent. Ordinary write failures roll both keys back.
 const projectsBefore=storage.getItem('mission.projects.v1'), journalBefore=storage.getItem(MISSION_STATE_KEY)
 try {saveProject(updated,storage);storage.setItem(MISSION_STATE_KEY,JSON.stringify({...state,history:next}))}
 catch {try {if(projectsBefore!==null)storage.setItem('mission.projects.v1',projectsBefore);if(journalBefore!==null)storage.setItem(MISSION_STATE_KEY,journalBefore)}catch{fail('Speicherfehler: Prüfe dein Backup. Ein vorhandener Session-Beleg verhindert erneute Übernahme.')}fail('Speichern fehlgeschlagen. Die bisherigen Daten wurden wiederhergestellt.')}
 return {project:updated,history:next}
}
export function reconcileAppliedReviews(history:SessionHistoryEntry[],projects:LongTermProject[]) {
 return history.map(e=>{const receipt=projects.find(p=>p.id===e.sourceProject?.projectId)?.learningState?.recentProgress.find(p=>p.sessionId===e.id);return receipt && e.projectReview && e.projectReview.status!=='applied' ? {...e,projectReview:{...e.projectReview,status:'applied' as const,appliedAt:receipt.createdAt}} : e})
}
export async function generateSessionReview(input:ReviewInput,fetchImpl:typeof fetch=globalThis.fetch) {
 const safe=readReviewInput(input),fallback=localReview(safe),controller=new AbortController()
 let timer:ReturnType<typeof setTimeout> | undefined
 try {
 const result=await Promise.race([(async()=>{
  const response=await fetchImpl('/api/project-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(safe),signal:controller.signal})
  if(!response.ok)throw new Error('request')
  const body=await response.json()
  if(!body || Object.keys(body).some(k=>!['source','review'].includes(k)) || !['mock','groq'].includes(body.source))throw new Error('schema')
  const proposal=readReviewProposal(body.review,safe.milestoneIds)
  if(proposal.suggestedKnown.some(t=>!safe.learningState?.known.some(k=>k.toLocaleLowerCase()===t.toLocaleLowerCase())))throw new Error('unsupported_known')
  return {proposal,notice:body.source==='mock' ? 'Lokaler Mock-Vorschlag. Bitte bestätige deinen Lernstand selbst.' : 'KI-Vorschlag: Bitte prüfe und korrigiere alle Angaben.'}
 })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},25000)})])
 return result
 }catch{return {proposal:fallback,notice:'Die KI-Auswertung war nicht verfügbar. Der lokale Review bleibt vollständig bearbeitbar.'}}
 finally{clearTimeout(timer)}
}
