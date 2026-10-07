import { createFallbackRoadmap, readProjectInput, readRoadmap, readProject, readProjectStore, PROJECT_STORAGE_KEY, MAX_PROJECTS, type ProjectInput, type LongTermProject, type LongTermRoadmap } from '../../shared/longTermProjectSchema.mjs'
export const projectId = () => 'project-' + crypto.randomUUID()
type Store = Pick<Storage, 'getItem' | 'setItem'>
export function loadProjects(storage: Pick<Storage,'getItem'> = localStorage) {
 try { const raw=storage.getItem(PROJECT_STORAGE_KEY); return raw ? {...readProjectStore(JSON.parse(raw),true), damaged:false} : {version:1 as const,projects:[],rejected:0,damaged:false} }
 catch { return {version:1 as const,projects:[],rejected:0,damaged:true} }
}
export function saveProject(project:LongTermProject,storage:Store=localStorage) {
 const safe=readProject(project), loaded=loadProjects(storage)
 if(loaded.damaged) throw new Error('Der Projektspeicher ist beschädigt. Sichere die Daten, bevor du ihn über Info & Daten ersetzt.')
 const projects=[...loaded.projects.filter(p=>p.id !== safe.id),safe]
 if(projects.length > MAX_PROJECTS) throw new Error('Maximal 50 lokale Projekte. Ein weiteres Projekt kann nicht gespeichert werden.')
 storage.setItem(PROJECT_STORAGE_KEY,JSON.stringify({version:1,projects})); return projects
}
export function createProject(input:ProjectInput,roadmap:LongTermRoadmap):LongTermProject {
 const now=new Date().toISOString()
 return readProject({...readProjectInput(input),version:1,id:projectId(),createdAt:now,updatedAt:now,status:'active',roadmap,manualNotes:''})
}
export function reorder<T extends {order:number}>(items:T[],index:number,offset:number):T[] {
 const next=[...items], target=index+offset
 if(index < 0 || index >= next.length || target < 0 || target >= next.length) return next
 const [item]=next.splice(index,1); next.splice(target,0,item)
 return next.map((v,order)=>({...v,order}))
}
export async function generateProjectRoadmap(input:ProjectInput,fetchImpl:typeof fetch=globalThis.fetch) {
 const safe=readProjectInput(input), controller=new AbortController()
 let timer:ReturnType<typeof setTimeout> | undefined
 try {
  const result=await Promise.race([(async()=>{
   const response=await fetchImpl('/api/project-roadmap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(safe),signal:controller.signal})
   if(!response.ok) throw new Error('request')
   const body=await response.json()
   if(!body || Object.keys(body).some(k=>!['roadmap','source'].includes(k)) || !['mock','groq'].includes(body.source)) throw new Error('schema')
   return {roadmap:readRoadmap(body.roadmap),notice:body.source === 'mock' ? 'Mock-Roadmap: kein externer KI-Dienst aufgerufen.' : 'KI-Roadmap erstellt. Prüfe und bearbeite den Vorschlag.'}
  })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},25000)})])
  // IDs are local and independent of provider-generated values.
  return {...result,roadmap:{...result.roadmap,phases:result.roadmap.phases.map(p=>({...p,id:projectId(),milestones:p.milestones.map(m=>({...m,id:projectId()}))}))}}
 } catch {return {roadmap:createFallbackRoadmap(safe,projectId),notice:'Die KI-Roadmap war nicht verfügbar. Ein lokaler, generischer Vorschlag wurde erstellt.'}}
 finally {clearTimeout(timer)}
}
