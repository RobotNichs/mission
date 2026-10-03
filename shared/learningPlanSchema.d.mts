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

export type PlanDiagnosisCode = 'invalid_response_structure' | 'invalid_question' | 'followup_question_forbidden' | 'invalid_step_count' | 'invalid_step_title' | 'invalid_step_description' | 'invalid_step_minutes' | 'invalid_step_type' | 'topic_reference_missing' | 'minutes_total_mismatch' | 'learning_activity_missing'
export function diagnoseAiPlanDraft(value: unknown, input: LearningPlanRequest): PlanDiagnosisCode | null
