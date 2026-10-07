import type { LearningContext } from './learningContext.mjs'
export type ProjectInput = {
 title: string; goal: string
 startingLevel: {type: 'beginner' | 'basic' | 'advanced' | 'custom'; description?: string; priorKnowledge?: string}
 duration: {type:'fixed-days';days:number} | {type:'date';targetDate:string} | {type:'open-ended'}
 weeklyMinutes:number; daysPerWeek:number | null; learningContext:LearningContext
}
export type Milestone = {id:string;title:string;description?:string;order:number;status?:'pending'|'completed'}
export type RoadmapPhase = {id:string;title:string;description:string;order:number;expectedDuration?:{type:'days'|'weeks';value:number};milestones:Milestone[]}
export type LongTermRoadmap = {version:1;summary:string;phases:RoadmapPhase[]}
export type LongTermProject = ProjectInput & {version:1;id:string;createdAt:string;updatedAt:string;status:'active'|'paused'|'completed'|'archived';roadmap:LongTermRoadmap;manualNotes:string}
export const MAX_PROJECTS: number
export const MAX_PHASES: number
export const MAX_MILESTONES: number
export const PROJECT_STORAGE_KEY: string
export function readProjectInput(v:unknown, referenceDate?:string):ProjectInput
export function readRoadmap(v:unknown):LongTermRoadmap
export function readProject(v:unknown):LongTermProject
export function readProjectStore(v:unknown,isolate?:boolean):{version:1;projects:LongTermProject[];rejected:number}
export function createFallbackRoadmap(input:ProjectInput,createId:()=>string):LongTermRoadmap
