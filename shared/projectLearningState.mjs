function fail() {throw new Error('Ungültiger Projekt-Lernstand.')}
export function fields(v,keys) {if(!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.includes(k)))fail();return v}
export function boundedText(v,max,empty=false) {if(typeof v!=='string' || v.length>max || (!empty && !v.trim()) || /<\/?[a-z][^>]*>|<!--|[\u0000-\u0008\u000b-\u001f]/i.test(v))fail();return v.trim()}
export function timestamp(v) {if(typeof v!=='string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString()!==v)fail();return v}
export function topicList(v,max=30) {if(!Array.isArray(v) || v.length>max)fail();const a=v.map(s=>boundedText(s,120));if(new Set(a.map(s=>s.toLocaleLowerCase('de'))).size!==a.length)fail();return a}
export function emptyLearningState() {return {version:1,known:[],inProgress:[],weak:[],recentProgress:[],nextSessionNote:''}}
export function readLearningState(v) {
 const r=fields(v,['version','known','inProgress','weak','recentProgress','nextSessionNote'])
 if(r.version!==1 || !Array.isArray(r.recentProgress) || r.recentProgress.length>10)fail()
 const recentProgress=r.recentProgress.map(v=>{const p=fields(v,['id','sessionId','createdAt','summary']);return {id:boundedText(p.id,100),sessionId:boundedText(p.sessionId,100),createdAt:timestamp(p.createdAt),summary:boundedText(p.summary,240)}})
 if(new Set(recentProgress.map(p=>p.id)).size!==recentProgress.length || new Set(recentProgress.map(p=>p.sessionId)).size!==recentProgress.length)fail()
 return {version:1,known:topicList(r.known),inProgress:topicList(r.inProgress),weak:topicList(r.weak),recentProgress,nextSessionNote:boundedText(r.nextSessionNote ?? '',240,true)}
}
export function readLearningContextState(v) {
 const r=fields(v,['version','known','inProgress','weak','recentProgress','nextSessionNote'])
 if(r.version!==1 || !Array.isArray(r.recentProgress) || r.recentProgress.length>3)fail()
 return {version:1,known:topicList(r.known,5),inProgress:topicList(r.inProgress,5),weak:topicList(r.weak,5),recentProgress:r.recentProgress.map(s=>boundedText(s,240)),nextSessionNote:boundedText(r.nextSessionNote ?? '',240,true)}
}

export function selectLearningContextState(value,focus='') {
 const s=readLearningState(value), words=focus.toLocaleLowerCase('de').match(/[\p{L}\p{N}]+/gu) ?? []
 const choose=list=>list.map((text,i)=>({text,i,score:words.filter(w=>w.length>3 && text.toLocaleLowerCase('de').includes(w)).length})).sort((a,b)=>b.score-a.score || a.i-b.i).slice(0,5).map(v=>v.text)
 return {version:1,known:choose(s.known),inProgress:choose(s.inProgress),weak:choose(s.weak),recentProgress:[...s.recentProgress].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3).map(p=>p.summary),nextSessionNote:s.nextSessionNote}
}
