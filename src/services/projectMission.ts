import { buildProjectMissionContext, projectSource, readProjectMissionContext, type ProjectMissionContext } from '../../shared/projectMissionContext.mjs'
import { loadProjects } from './longTermProjects'
import { validatePlanInput } from '../../shared/learningPlanSchema.mjs'
import { validFocusStrategy, type FocusStrategy } from './focusBlocks'
import type { LearningPlanInput, LearningPlanRequest } from '../types/learningPlan'
export type ProjectSessionInput = Pick<LearningPlanInput,'timeBudgetMinutes'|'energyLevel'|'learningBlocker'|'learningBlockerDetails'> & {focusStrategy?:FocusStrategy}
export function currentProjectContext(projectId:string,storage:Pick<Storage,'getItem'>=localStorage):ProjectMissionContext {
 const loaded=loadProjects(storage)
 if(loaded.damaged)throw new Error('Der Projektspeicher ist beschädigt. Es wurde keine Mission übernommen.')
 const project=loaded.projects.find(p=>p.id===projectId)
 if(!project)throw new Error('Das Projekt ist nicht mehr vorhanden oder beschädigt. Es wurde keine Mission übernommen.')
 return buildProjectMissionContext(project)
}
export function projectMissionRequest(projectId:string,session:ProjectSessionInput):LearningPlanRequest {
 const projectContext=currentProjectContext(projectId)
 const request={goal:projectContext.goal,timeBudgetMinutes:session.timeBudgetMinutes,energyLevel:session.energyLevel,learningBlocker:session.learningBlocker,...(session.learningBlocker==='other' ? {learningBlockerDetails:session.learningBlockerDetails ?? ''} : {}),learningContext:projectContext.learningContext,projectContext}
 if(!validatePlanInput(request) || (session.focusStrategy!==undefined && !validFocusStrategy(session.focusStrategy)))throw new Error('Bitte prüfe Zeit (5–60 Minuten in Fünferschritten), Energie, Lernblocker und Fokusstrategie.')
 return request
}
export function assertCurrentProjectContext(context:ProjectMissionContext) {
 const safe=readProjectMissionContext(context), latest=currentProjectContext(safe.projectId)
 if(JSON.stringify(latest)!==JSON.stringify(safe))throw new Error('Das Projekt oder seine aktuelle Etappe hat sich geändert. Bitte erstelle die Mission erneut.')
 return projectSource(latest)
}
