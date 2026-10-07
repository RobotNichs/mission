import type { ProjectInput, LongTermProject } from './longTermProjectSchema.mjs'
import type { SourceProject } from './sourceProject.mjs'
import type { LearningPlanRequest } from '../src/types/learningPlan'
export type ProjectMissionContext = ProjectInput & {version:1;projectId:string;roadmapSummary:string;phase:{id:string;title:string;description:string;milestones:{id:string;title:string;description:string}[]}}
export const MAX_PROJECT_CONTEXT_BYTES:number
export const MAX_SESSION_MILESTONES:number
export function readProjectMissionContext(v:unknown):ProjectMissionContext
export function validateProjectMissionContext(v:unknown):v is ProjectMissionContext
export function buildProjectMissionContext(p:LongTermProject):ProjectMissionContext
export function projectSource(c:ProjectMissionContext):SourceProject
export function isKnownTopic(title:string,c:Pick<ProjectInput,'startingLevel'> & Partial<Pick<ProjectInput,'title'|'goal'>>):boolean
export function projectSessionTarget(c:ProjectMissionContext):string
export function unnecessaryKnownTopic(steps:{title:string;kind:string;minutes:number}[],input:LearningPlanRequest):number
export function projectSessionActions(input:LearningPlanRequest):{title:string;description:string;kind:'practice'|'reflection'}[]
export function projectSessionDescription(action:string,input:LearningPlanRequest,index:number,kind:'practice'|'reflection',last:boolean):string
