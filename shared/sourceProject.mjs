export function validateSourceProject(v) {
 const id=s=>typeof s==='string' && s.trim().length>0 && s.length<=100 && !/<\/?[a-z][^>]*>|<!--|[\u0000-\u0008\u000b-\u001f]/i.test(s)
 return !!v && typeof v==='object' && !Array.isArray(v)
  && Object.keys(v).every(k=>['projectId','phaseId','milestoneIds'].includes(k)) && id(v.projectId)
  && (v.phaseId===undefined || id(v.phaseId))
  && (v.milestoneIds===undefined || (v.phaseId!==undefined && Array.isArray(v.milestoneIds) && v.milestoneIds.length<=8 && v.milestoneIds.every(id) && new Set(v.milestoneIds).size===v.milestoneIds.length))
}
export function readSourceProject(v) {
 if(!validateSourceProject(v)) return undefined
 return {projectId:v.projectId,...(v.phaseId!==undefined ? {phaseId:v.phaseId} : {}),...(v.milestoneIds!==undefined ? {milestoneIds:[...v.milestoneIds]} : {})}
}
