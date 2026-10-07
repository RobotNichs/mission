import { personalizeContextAction } from './learningContext.mjs'
import { readProject, readProjectInput } from './longTermProjectSchema.mjs'
import { validateSourceProject } from './sourceProject.mjs'
export const MAX_PROJECT_CONTEXT_BYTES = 6144
export const MAX_SESSION_MILESTONES = 3
function fail() {throw new Error('Der Projektkontext ist ungültig oder zu groß.')}
function fields(v,keys) {if(!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.includes(k))) fail();return v}
function text(v,max,empty=false) {if(typeof v!=='string' || v.length>max || (!empty && !v.trim()) || /<\/?[a-z][^>]*>|<!--|[\u0000-\u0008\u000b-\u001f]/i.test(v))fail();return v}
function id(v) {if(!validateSourceProject({projectId:v}))fail();return v}
const stop=new Set('ich kann kenne bereits schon mit und oder der die das ein eine zu von im in auf als grundlagen lernen thema themen anwenden vertiefen verstehen habe bin beherrsche bekannt'.split(' '))
const tokens=s=>(s.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g) ?? []).filter(w=>w.length>3 && !stop.has(w))
// Deliberately lexical: free-form knowledge is not a machine-readable skill state.
export function isKnownTopic(title,context) {
 const knowledge=(context.startingLevel.priorKnowledge ?? '').split(/[,;.!?\n]+/).filter(clause=>! /\b(nicht|keine?[nmr]?|kaum|not|never)\b/i.test(clause)).join(' ')
 const known=new Set(tokens(knowledge))
 const domain=new Set(tokens((context.goal ?? '')+' '+(context.title ?? '')))
 const topic=tokens(title), specific=topic.filter(w=>!domain.has(w))
 return (specific.length ? specific : topic).some(w=>known.has(w))
}
export function projectSource(context) {return {projectId:context.projectId,phaseId:context.phase.id,milestoneIds:context.phase.milestones.map(m=>m.id)}}
export function readProjectMissionContext(v) {
 const r=fields(v,['version','projectId','title','goal','startingLevel','duration','weeklyMinutes','daysPerWeek','learningContext','roadmapSummary','phase'])
 if(new TextEncoder().encode(JSON.stringify(r)).length>MAX_PROJECT_CONTEXT_BYTES || r.version!==1)fail()
 // Dates are historical planning information; not a new deadline request.
 const input=readProjectInput(Object.fromEntries(['title','goal','startingLevel','duration','weeklyMinutes','daysPerWeek','learningContext'].map(k=>[k,r[k]])),r.duration?.type==='date' && r.duration.targetDate < new Date().toISOString().slice(0,10) ? r.duration.targetDate : undefined)
 const p=fields(r.phase,['id','title','description','milestones'])
 if(!Array.isArray(p.milestones) || !p.milestones.length || p.milestones.length>MAX_SESSION_MILESTONES)fail()
 const milestones=p.milestones.map(v=>{const m=fields(v,['id','title','description']);return {id:id(m.id),title:text(m.title,90),description:text(m.description,200,true)}})
 if(new Set([p.id,...milestones.map(m=>m.id)]).size!==milestones.length+1)fail()
 return {...input,version:1,projectId:id(r.projectId),roadmapSummary:text(r.roadmapSummary,240,true),phase:{id:id(p.id),title:text(p.title,90),description:text(p.description,240,true),milestones}}
}
export function buildProjectMissionContext(value) {
 const p=readProject(value)
 if(p.status!=='active')throw new Error('Reaktiviere das Projekt, bevor du eine Tagesmission erstellst.')
 const phase=p.roadmap.phases.find(v=>v.milestones.some(m=>m.status!=='completed'))
 if(!phase)throw new Error('Alle Meilensteine sind erledigt. Öffne eine nächste Etappe, bevor du eine Tagesmission erstellst.')
 const pending=phase.milestones.filter(m=>m.status!=='completed')
 const relevant=[...pending.filter(m=>!isKnownTopic(m.title,p)),...pending.filter(m=>isKnownTopic(m.title,p))].slice(0,MAX_SESSION_MILESTONES)
 const compact={version:1,projectId:p.id,title:p.title,goal:p.goal,startingLevel:p.startingLevel,duration:p.duration,weeklyMinutes:p.weeklyMinutes,daysPerWeek:p.daysPerWeek,learningContext:p.learningContext,roadmapSummary:p.roadmap.summary.slice(0,240),phase:{id:phase.id,title:phase.title,description:phase.description.slice(0,240),milestones:relevant.map(m=>({id:m.id,title:m.title,description:m.description ?? ''}))}}
 const bytes=()=>new TextEncoder().encode(JSON.stringify(compact)).length
 if(bytes()>MAX_PROJECT_CONTEXT_BYTES) {compact.roadmapSummary='';compact.phase.description='';compact.phase.milestones=compact.phase.milestones.map(m=>({...m,description:''}))}
 if(bytes()>MAX_PROJECT_CONTEXT_BYTES) compact.startingLevel={...compact.startingLevel,...(compact.startingLevel.priorKnowledge ? {priorKnowledge:compact.startingLevel.priorKnowledge.slice(0,300)} : {}),...(compact.startingLevel.description ? {description:compact.startingLevel.description.slice(0,200)} : {})}
 if(bytes()>MAX_PROJECT_CONTEXT_BYTES) compact.phase.milestones=compact.phase.milestones.slice(0,1)
 return readProjectMissionContext(compact)
}
export function validateProjectMissionContext(v) {try{readProjectMissionContext(v);return true}catch{return false}}
export function projectSessionTarget(context) {
 return context.phase.milestones.find(m=>!isKnownTopic(m.title,context))?.title ?? 'Nächsten kleinen Anwendungsschritt wählen'
}
export function unnecessaryKnownTopic(steps,input) {
 if(!input.projectContext)return -1
 const context=input.projectContext, limit=Math.min(5,Math.max(1,Math.floor(input.timeBudgetMinutes/5)))
 const known=steps.map((s,i)=>({s,i})).filter(({s})=>['learning','practice'].includes(s.kind) && isKnownTopic(s.title,context))
 const invalid=known.find(({s})=>!(/wiederholung|abruf|selbstpr.fung|einordnung/i.test(s.title) && s.minutes<=limit))
 if(invalid)return invalid.i
 return known.reduce((sum,{s})=>sum+s.minutes,0)>limit ? known[0].i : -1
}

export function projectSessionActions(input) {
 const c=readProjectMissionContext(input.projectContext), target=projectSessionTarget(c)
 const focus='Phase „'+c.phase.title+'“, nächste Etappe „'+target+'“.'
 const energy=input.energyLevel==='low' ? 'Ein kleiner, klarer Teil genügt; halte den Einstieg leicht.' : input.energyLevel==='high' ? 'Versuche eine anspruchsvollere eigene Anwendung dieses einen Teils.' : 'Bearbeite einen begrenzten Teil in deinem Tempo.'
 const blocker={starting:'Notiere zuerst genau eine Frage und deinen ersten kleinen Ansatz.',understanding:'Markiere die erste unklare Stelle und formuliere eine konkrete Frage.',focus:'Schließe ablenkende Tabs und bleibe bei genau einer Handlung.',time:'Wähle nur den wichtigsten kleinen Teil und lasse Zusatzthemen weg.',other:'Wähle einen kleinen Einstieg passend zu deiner angegebenen Lernhürde.'}[input.learningBlocker] ?? 'Wähle einen kleinen eigenen Ansatz.'
 const known=c.startingLevel.priorKnowledge ? 'Nutze dein angegebenes Vorwissen; bearbeite eine Lücke oder nächste Anwendung statt Bekanntes neu zu lernen.' : 'Orientiere dich an deiner Ausgangslage und wähle einen erreichbaren Teil.'
 const actions=[{title:'Nächsten kleinen Ansatz wählen',description:focus+' '+blocker+' '+energy+' '+known,kind:'practice'}, {title:'Einen begrenzten Teil anwenden',description:'Versuche einen kleinen eigenen Ansatz zur ausgewählten offenen Etappe. Halte am ersten unklaren Schritt an. '+energy,kind:'practice'}, {title:'Offene Frage und nächsten Schritt sichern',description:'Prüfe, was du selbst erklären kannst. Notiere genau eine offene Frage und den nächsten kleinen Ansatz; schließe keine Projektmeilensteine automatisch ab.',kind:'reflection'}]
 return input.timeBudgetMinutes<=10 ? actions.slice(0,1) : actions
}

export function projectSessionDescription(action,input,index,kind,last) {
 const c=input.projectContext
 const focus='Aktuelle Phase „'+c.phase.title+'“, nächste Etappe „'+projectSessionTarget(c)+'“. '
 const energy=input.energyLevel==='low' ? 'Ein kleiner eigener Teil genügt. ' : input.energyLevel==='high' ? 'Versuche eine anspruchsvollere eigene Anwendung. ' : 'Bearbeite einen Teil in deinem Tempo. '
 const known=index===0 && c.startingLevel.priorKnowledge ? 'Nutze dein Vorwissen für eine Lücke oder nächste Anwendung statt Bekanntes neu zu lernen. ' : ''
 return (focus+energy+known+personalizeContextAction(action,input,index,kind,last)).slice(0,600)
}
