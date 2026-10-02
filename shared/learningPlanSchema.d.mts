import type { LearningPlan, LearningPlanInput, LearningPlanRequest, LearningStepKind } from '../src/types/learningPlan'

export type AiLearningPlanStep = {
  title: string
  description: string
  minutes: number
  kind: LearningStepKind
  topicFocus: string
}

export type AiLearningPlanDraft = {
  clarifyingQuestion: string | null
  steps: AiLearningPlanStep[]
}

export type LearningPlanSource = 'mock' | 'groq'
export type LearningPlanApiResponse = {
  source: LearningPlanSource
  clarifyingQuestion: string | null
  plan: LearningPlan
}

export function validatePlanInput(value: unknown): value is LearningPlanRequest
export function validateAiPlanDraft(value: unknown, input: LearningPlanRequest): value is AiLearningPlanDraft
export function validateLearningPlanResponse(value: unknown, input: LearningPlanRequest): value is LearningPlanApiResponse
