import type { SourceProject } from './sourceProject.mjs'
import type { LearningContextState } from './projectLearningState.mjs'
export type ReviewStep={id:string;title:string;description:string;done:boolean}
export type ReviewProposal={sessionSummary:string;suggestedKnown:string[];suggestedInProgress:string[];suggestedWeak:string[];milestoneSuggestions:{milestoneId:string;suggestion:'keep-open'|'mark-completed';reason:string}[];nextSessionNote:string}
export type SessionReview={version:1;status:'pending'|'skipped'|'applied';steps:ReviewStep[];draft?:ReviewProposal;appliedAt?:string}
export type ReviewInput={version:1;sessionId:string;projectGoal:string;phase:{id:string;title:string};milestoneIds:string[];steps:ReviewStep[];focusSeconds:number;completedSteps:number;totalSteps:number;learningState?:LearningContextState}
export const MAX_REVIEW_INPUT_BYTES:number
export function readReviewSteps(v:unknown):ReviewStep[]
export function readReviewProposal(v:unknown,ids:string[]):ReviewProposal
export function readSessionReview(v:unknown,source:SourceProject):SessionReview
export function readReviewInput(v:unknown):ReviewInput
export function localReview(input:ReviewInput):ReviewProposal
