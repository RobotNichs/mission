import { validateLearningPlanResponse } from '../../shared/learningPlanSchema.mjs'
import type { LearningPlan, LearningPlanInput } from '../types/learningPlan'
import { generateRuleBasedLearningPlan } from './ruleBasedLearningPlan'

export type LearningPlanGenerationResult = {
  plan: LearningPlan
  source: 'mock' | 'groq' | 'fallback'
  clarifyingQuestion: string | null
  notice: string
}

export async function generateLearningPlanWithStatus(
  input: LearningPlanInput,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<LearningPlanGenerationResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    let response: Response
    try {
      response = await fetchImpl('/api/learning-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) throw new Error('API request failed')
    const payload: unknown = await response.json()
    if (!validateLearningPlanResponse(payload, input)) throw new Error('API response schema is invalid')

    const source = payload.source
    const baseNotice = source === 'mock'
      ? 'Mock-Antwort: Es wurde kein externer KI-Dienst aufgerufen.'
      : 'Der KI-Lernplan wurde erstellt.'
    return {
      plan: payload.plan,
      source,
      clarifyingQuestion: payload.clarifyingQuestion,
      notice: payload.clarifyingQuestion
        ? `${baseNotice} Rückfrage: ${payload.clarifyingQuestion}`
        : baseNotice,
    }
  } catch {
    return {
      plan: generateRuleBasedLearningPlan(input),
      source: 'fallback',
      clarifyingQuestion: null,
      notice: 'Der KI-Endpunkt ist nicht erreichbar oder lieferte ungültige Daten. Ein lokaler Ersatzplan wurde erstellt.',
    }
  }
}
