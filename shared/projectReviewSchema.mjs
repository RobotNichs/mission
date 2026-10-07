import { fields, boundedText, topicList, timestamp, readLearningContextState } from './projectLearningState.mjs'
import { readSourceProject } from './sourceProject.mjs'
export const MAX_REVIEW_INPUT_BYTES=12*1024
function fail(){throw new Error('Ungültiger Session-Review. Bitte prüfe Texte und Projektverweise.')}
export function readReviewSteps(v) {
 if(!Array.isArray(v) || v.length>12)fail()
 const steps=v.map(v=>{const s=fields(v,['id','title','description','done']);if(typeof s.done!=='boolean')fail();return {id:boundedText(s.id,100),title:boundedText(s.title,90),description:boundedText(s.description,200,true),done:s.done}})
 if(new Set(steps.map(s=>s.id)).size!==steps.length)fail()
 return steps
}
export function readReviewProposal(v,ids) {
 const r=fields(v,['sessionSummary','suggestedKnown','suggestedInProgress','suggestedWeak','milestoneSuggestions','nextSessionNote'])
 if(!Array.isArray(r.milestoneSuggestions) || r.milestoneSuggestions.length>8)fail()
 const milestoneSuggestions=r.milestoneSuggestions.map(v=>{const m=fields(v,['milestoneId','suggestion','reason']);if(!ids.includes(m.milestoneId) || !['keep-open','mark-completed'].includes(m.suggestion))fail();return {milestoneId:boundedText(m.milestoneId,100),suggestion:m.suggestion,reason:boundedText(m.reason,160,true)}})
 if(new Set(milestoneSuggestions.map(m=>m.milestoneId)).size!==milestoneSuggestions.length)fail()
 return {sessionSummary:boundedText(r.sessionSummary,240),suggestedKnown:topicList(r.suggestedKnown,3),suggestedInProgress:topicList(r.suggestedInProgress,3),suggestedWeak:topicList(r.suggestedWeak,3),milestoneSuggestions,nextSessionNote:boundedText(r.nextSessionNote ?? '',240,true)}
}
export function readSessionReview(v,source) {
 const r=fields(v,['version','status','steps','draft','appliedAt'])
 if(r.version!==1 || !['pending','skipped','applied'].includes(r.status) || !readSourceProject(source))fail()
 if(r.status==='applied' ? r.appliedAt===undefined : r.appliedAt!==undefined)fail()
 return {version:1,status:r.status,steps:readReviewSteps(r.steps),...(r.draft!==undefined ? {draft:readReviewProposal(r.draft,source.milestoneIds ?? [])} : {}),...(r.appliedAt!==undefined ? {appliedAt:timestamp(r.appliedAt)} : {})}
}
export function readReviewInput(v) {
 const r=fields(v,['version','sessionId','projectGoal','phase','milestoneIds','steps','focusSeconds','completedSteps','totalSteps','learningState'])
 if(new TextEncoder().encode(JSON.stringify(r)).length>MAX_REVIEW_INPUT_BYTES || r.version!==1)fail()
 const phase=fields(r.phase,['id','title'])
 if(!Array.isArray(r.milestoneIds) || r.milestoneIds.length>8 || new Set(r.milestoneIds).size!==r.milestoneIds.length)fail()
 if(typeof r.focusSeconds!=='number' || !Number.isFinite(r.focusSeconds) || r.focusSeconds<=0 || r.focusSeconds>Number.MAX_SAFE_INTEGER)fail()
 if(!Number.isInteger(r.totalSteps) || r.totalSteps<0 || r.totalSteps>100 || !Number.isInteger(r.completedSteps) || r.completedSteps<0 || r.completedSteps>r.totalSteps)fail()
 return {version:1,sessionId:boundedText(r.sessionId,100),projectGoal:boundedText(r.projectGoal,280),phase:{id:boundedText(phase.id,100),title:boundedText(phase.title,90)},milestoneIds:r.milestoneIds.map(id=>boundedText(id,100)),steps:readReviewSteps(r.steps),focusSeconds:r.focusSeconds,completedSteps:r.completedSteps,totalSteps:r.totalSteps,...(r.learningState!==undefined ? {learningState:readLearningContextState(r.learningState)} : {})}
}
export function localReview(input) {
 const r=readReviewInput(input), titles=r.steps.filter(s=>s.done).map(s=>s.title)
 return readReviewProposal({sessionSummary:('Bearbeitet: '+(titles.length ? titles.join('; ') : r.steps.map(s=>s.title).join('; ') || r.phase.title)+'. '+Math.floor(r.focusSeconds/60)+' Minuten Fokus. Bitte schätze deinen Lernstand selbst ein.').slice(0,240),suggestedKnown:[],suggestedInProgress:[],suggestedWeak:[],milestoneSuggestions:r.milestoneIds.map(milestoneId=>({milestoneId,suggestion:'keep-open',reason:'Die Session allein belegt keinen Meilensteinabschluss. Bitte selbst prüfen.'})),nextSessionNote:''},r.milestoneIds)
}
