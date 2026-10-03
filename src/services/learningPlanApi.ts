import { validateLearningPlanResponse } from '../../shared/learningPlanSchema.mjs'
import type { LearningPlan, LearningPlanRequest } from '../types/learningPlan'
import { generateRuleBasedLearningPlan } from './ruleBasedLearningPlan'

export type LearningPlanGenerationResult = {
  plan: LearningPlan
  source: 'mock' | 'groq' | 'fallback'
  clarifyingQuestion: string | null
  notice: string
}

const failureMessages: Record<string, string> = {
  provider_unreachable: 'Der KI-Anbieter ist derzeit nicht erreichbar.',
  provider_timeout: 'Die KI-Anfrage hat zu lange gedauert.',
  provider_http_error: 'Der KI-Anbieter hat die Anfrage nicht erfolgreich verarbeitet.',
  invalid_json: 'Der KI-Lernplan konnte wegen eines ungültigen Antwortformats nicht übernommen werden.',
  model_content_missing: 'Die KI-Antwort enthielt keinen Lernplan.',
  model_output_truncated: 'Die KI-Antwort wurde vorzeitig abgeschnitten.',
  invalid_plan_schema: 'Der KI-Lernplan entsprach nicht den erforderlichen Planregeln.',
  internal_error: 'Beim Erstellen des KI-Lernplans ist ein interner Fehler aufgetreten.',
  invalid_input: 'Die Lernplananfrage enthält ungültige Eingaben.',
  provider_not_configured: 'Der KI-Anbieter ist noch nicht vollständig konfiguriert.',
  provider_not_supported: 'Der konfigurierte KI-Anbieter wird nicht unterstützt.',
  rate_limited: 'Zu viele Lernplananfragen. Bitte warte kurz.',
  invalid_request: 'Die Lernplananfrage konnte nicht verarbeitet werden.',
}

class ApiFailure extends Error {
  constructor(readonly category: string, readonly diagnosisId: string) { super(category) }
}

function readFailure(payload: unknown, localId: string): ApiFailure {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return new ApiFailure('internal_error', localId)
  const error = payload.error
  if (typeof error !== 'object' || error === null) return new ApiFailure('internal_error', localId)
  const category = 'category' in error && typeof error.category === 'string' && Object.hasOwn(failureMessages, error.category)
    ? error.category : 'internal_error'
  const diagnosisId = 'diagnosisId' in error && typeof error.diagnosisId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(error.diagnosisId)
    ? error.diagnosisId : localId
  return new ApiFailure(category, diagnosisId)
}

export async function generateLearningPlanWithStatus(
  input: LearningPlanRequest,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<LearningPlanGenerationResult> {
  const localId = crypto.randomUUID()
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new ApiFailure('provider_timeout', localId))
    }, 25_000)
  })
  try {
    return await Promise.race([(async () => {
      let response: Response
      try {
        response = await fetchImpl('/api/learning-plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        })
      } catch {
        throw new ApiFailure(controller.signal.aborted ? 'provider_timeout' : 'provider_unreachable', localId)
      }
      let payload: unknown
      try { payload = await response.json() } catch {
        throw new ApiFailure(controller.signal.aborted ? 'provider_timeout' : 'invalid_json', localId)
      }
      if (!response.ok) throw readFailure(payload, localId)
      if (!validateLearningPlanResponse(payload, input)) throw new ApiFailure('invalid_plan_schema', localId)
      const source = payload.source
      const baseNotice = source === 'mock'
        ? 'Mock-Antwort: Es wurde kein externer KI-Dienst aufgerufen.'
        : 'Der KI-Lernplan wurde erstellt.'
      return {
        plan: payload.plan, source,
        clarifyingQuestion: payload.clarifyingQuestion,
        notice: payload.clarifyingQuestion
          ? baseNotice + ' Rückfrage: ' + payload.clarifyingQuestion
          : baseNotice,
      }
    })(), expired])
  } catch (error) {
    const failure = error instanceof ApiFailure ? error : new ApiFailure('internal_error', localId)
    return {
      plan: generateRuleBasedLearningPlan(input), source: 'fallback', clarifyingQuestion: null,
      notice: failureMessages[failure.category] + ' Ein lokaler Ersatzplan wurde erstellt. Diagnose-ID: ' + failure.diagnosisId,
    }
  } finally {
    clearTimeout(timeout)
  }
}
