import { validateLearningContext } from './learningContext.mjs'
export const MAX_PROJECTS = 50
export const MAX_PHASES = 8
export const MAX_MILESTONES = 8
export const PROJECT_STORAGE_KEY = 'mission.projects.v1'
function fail() { throw new Error('Ungültiges Langzeitprojekt. Bitte prüfe Texte, Zeitraum und Roadmap.') }
function object(v, allowed) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !allowed.includes(k))) fail()
  return v
}
function text(v, max, empty = false) {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()) || /<\/?[a-z][^>]*>|<!--|[\u0000-\u0008\u000b-\u001f]/i.test(v)) fail()
  return v.trim()
}
function integer(v, min, max) { if (!Number.isSafeInteger(v) || v < min || v > max) fail(); return v }
function date(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) fail()
  return v
}
function timestamp(v) {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail()
  return v
}
export function readProjectInput(v, referenceDate = new Date().toISOString().slice(0,10)) {
  const r = object(v, ['title','goal','startingLevel','duration','weeklyMinutes','daysPerWeek','learningContext'])
  const level = object(r.startingLevel, ['type','description','priorKnowledge'])
  if (!['beginner','basic','advanced','custom'].includes(level.type)) fail()
  const startingLevel = { type: level.type, ...(level.description !== undefined ? { description: text(level.description,300,level.type !== 'custom') } : {}), ...(level.priorKnowledge !== undefined ? { priorKnowledge: text(level.priorKnowledge,400,true) } : {}) }
  if (level.type === 'custom' && !startingLevel.description) fail()
  const d = object(r.duration, ['type','days','targetDate'])
  let duration
  if (d.type === 'fixed-days' && Object.keys(d).length === 2) duration = {type:d.type,days:integer(d.days,1,3650)}
  else if (d.type === 'date' && Object.keys(d).length === 2) {
    const targetDate = date(d.targetDate), diff = (Date.parse(targetDate)-Date.parse(date(referenceDate)))/86400000
    if (diff < 0 || diff > 3650) fail()
    duration = {type:d.type,targetDate}
  } else if (d.type === 'open-ended' && Object.keys(d).length === 1) duration = {type:d.type}
  else fail()
  if (r.learningContext !== undefined && !validateLearningContext(r.learningContext)) fail()
  return { title:text(r.title,90), goal:text(r.goal,280), startingLevel, duration, weeklyMinutes:integer(r.weeklyMinutes,30,4200), daysPerWeek:r.daysPerWeek === null ? null : integer(r.daysPerWeek,1,7), learningContext:structuredClone(r.learningContext ?? {}) }
}
export function readRoadmap(v) {
  const r = object(v,['version','summary','phases'])
  if (r.version !== 1 || !Array.isArray(r.phases) || r.phases.length < 1 || r.phases.length > MAX_PHASES) fail()
  const ids = new Set()
  const id = v => { const s=text(v,100); if(ids.has(s)) fail(); ids.add(s); return s }
  const phases = r.phases.map((v,i) => {
    const p=object(v,['id','title','description','order','expectedDuration','milestones'])
    if (p.order !== i || !Array.isArray(p.milestones) || p.milestones.length < 1 || p.milestones.length > MAX_MILESTONES) fail()
    let expectedDuration
    if(p.expectedDuration !== undefined) { const d=object(p.expectedDuration,['type','value']); if(!['days','weeks'].includes(d.type)) fail(); expectedDuration={type:d.type,value:integer(d.value,1,3650)} }
    return {id:id(p.id),title:text(p.title,90),description:text(p.description,300,true),order:i,...(expectedDuration ? {expectedDuration} : {}), milestones:p.milestones.map((v,j)=>{
      const m=object(v,['id','title','description','order']); if(m.order !== j) fail()
      return {id:id(m.id),title:text(m.title,90),...(m.description !== undefined ? {description:text(m.description,200,true)} : {}),order:j}
    })}
  })
  return {version:1,summary:text(r.summary,400),phases}
}
export function readProject(v) {
  const p=object(v,['version','id','title','goal','createdAt','updatedAt','status','startingLevel','duration','weeklyMinutes','daysPerWeek','learningContext','roadmap','manualNotes'])
  if(p.version !== 1 || !['active','paused','completed','archived'].includes(p.status)) fail()
  const createdAt=timestamp(p.createdAt), updatedAt=timestamp(p.updatedAt)
  if(updatedAt < createdAt) fail()
  // Past end dates remain valid on reload.
  const input=readProjectInput(Object.fromEntries(['title','goal','startingLevel','duration','weeklyMinutes','daysPerWeek','learningContext'].map(k=>[k,p[k]])),createdAt.slice(0,10))
  return {...input,version:1,id:text(p.id,100),createdAt,updatedAt,status:p.status,roadmap:readRoadmap(p.roadmap),manualNotes:text(p.manualNotes ?? '',2000,true)}
}
export function readProjectStore(v, isolate = false) {
  const r=object(v,['version','projects'])
  if(r.version !== 1 || !Array.isArray(r.projects) || r.projects.length > MAX_PROJECTS) fail()
  const projects=[], seen=new Set(); let rejected=0
  for(const value of r.projects) {
    try {const p=readProject(value); if(seen.has(p.id)) fail(); seen.add(p.id); projects.push(p)} catch(e) {if(!isolate) throw e; rejected++}
  }
  return {version:1,projects,rejected}
}
export function createFallbackRoadmap(input, createId) {
  const r=readProjectInput(input)
  const days=r.duration.type === 'fixed-days' ? r.duration.days : r.duration.type === 'date' ? Math.max(1,Math.ceil((Date.parse(r.duration.targetDate)-Date.now())/86400000)) : null
  const titles=days && days <= 10 ? ['Einstieg und Standort','Gezielte Übung','Reflexion und nächster Schritt'] : ['Orientierung / Einstieg','Grundlagen','Übung','Anwendung','Reflexion / nächste Stufe']
  const level={beginner:'Beginne mit einer kleinen Frage ohne vorausgesetztes Vorwissen.',basic:'Nutze dein Vorwissen und wähle eine konkrete Lücke.',advanced:'Wähle eine anspruchsvollere Lücke in deinem vorhandenen Wissen.',custom:'Nutze deine beschriebene Ausgangslage und wähle den nächsten erreichbaren Schritt.'}[r.startingLevel.type]
  return readRoadmap({version:1,summary:('Vorschlag für „'+r.goal+'“ mit '+r.weeklyMinutes+' Minuten pro Woche'+(r.daysPerWeek ? ' an ungefähr '+r.daysPerWeek+' Tagen' : '')+'. '+(days ? 'Der Zeitraum ist eine Orientierung, keine Erfolgsgarantie.' : 'Rollierende Etappen: danach Ziel und nächste Stufe neu bestimmen.')).slice(0,400),phases:titles.map((title,i)=>({id:createId(),title,description:i===0 ? level : i===titles.length-1 ? 'Prüfe offene Fragen und passe den weiteren Weg an.' : 'Erarbeite einen begrenzten Teil, übe einen eigenen Ansatz und halte offene Fragen fest.',order:i,expectedDuration:days ? {type:'days',value:Math.max(1,Math.floor(days/titles.length)+(i < days%titles.length ? 1 : 0))} : {type:'weeks',value:Math.max(1,Math.ceil(120/r.weeklyMinutes))},milestones:[{id:createId(),title:i===0 ? 'Ausgangslage und nächste Frage festgehalten' : i===titles.length-1 ? 'Erkenntnisse und nächste Etappe festgehalten' : 'Einen begrenzten Teil selbst erklärt oder erprobt',description:'Prüfe selbst, was bereits gelingt und was noch offen ist.',order:0}]}))})
}
