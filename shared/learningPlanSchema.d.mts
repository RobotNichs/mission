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

export type PlanDiagnosisCode = 'invalid_response_structure' | 'invalid_question' | 'followup_question_forbidden' | 'invalid_step_count' | 'invalid_step_title' | 'invalid_step_description' | 'invalid_step_minutes' | 'invalid_step_type' | 'topic_reference_missing' | 'material_reference_unavailable' | 'minutes_total_mismatch' | 'learning_activity_missing' | 'known_topic_replanned'
export function diagnoseAiPlanDraft(value: unknown, input: LearningPlanRequest): PlanDiagnosisCode | null
export type PlanDiagnosisDetail = { schemaCode: PlanDiagnosisCode; field?: 'clarifyingQuestion' | 'steps' | 'title' | 'description' | 'minutes' | 'kind' | 'topicFocus'; stepIndex?: number }
export function diagnoseAiPlanDraftDetails(value: unknown, input: LearningPlanRequest): PlanDiagnosisDetail[]
export function diagnosePlanQuality(value: unknown): ('concrete_start_unclear' | 'repeated_step_text' | 'short_step_overload_possible')[]
