import type { LearningPlanRequest, LearningStepKind } from '../src/types/learningPlan'
export type LearningContext = {
  environment?: 'school' | 'university' | 'training' | 'work' | 'private' | 'other'
  purpose?: 'exam' | 'homework' | 'project' | 'revision' | 'new-topic' | 'interest' | 'other'
  materials?: ('slides' | 'script' | 'book' | 'worksheets' | 'notes' | 'online' | 'tasks' | 'none' | 'other')[]
  materialsDetails?: string
}
export const environmentOptions: readonly (readonly [NonNullable<LearningContext['environment']>, string])[]
export const purposeOptions: readonly (readonly [NonNullable<LearningContext['purpose']>, string])[]
export const materialOptions: readonly (readonly [NonNullable<LearningContext['materials']>[number], string])[]
export const MAX_CONTEXT_DETAILS: number
export function validateLearningContext(value: unknown): value is LearningContext
export function readLearningContext(value: unknown): LearningContext | undefined
export function needsMaterialQuestion(input: LearningPlanRequest): boolean
export function hasNoMaterials(input: LearningPlanRequest): boolean
export function unavailableMaterialStep(steps: { title: string; description: string }[], input: LearningPlanRequest): number
export function personalizeContextAction(description: string, input: LearningPlanRequest, index: number, kind: LearningStepKind, last?: boolean): string
