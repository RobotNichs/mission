import { afterEach, expect, it, vi } from 'vitest'
import { validatePlanInput } from '../shared/learningPlanSchema.mjs'
import { handleLearningPlanRequest } from './learningPlanApi.mjs'

afterEach(() => vi.restoreAllMocks())
const input = { goal: 'Statistik', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: 'other' }
it('validiert die optionale Lernhürde rückwärtskompatibel', () => {
  expect(validatePlanInput(input)).toBe(true)
  expect(validatePlanInput({ ...input, learningBlockerDetails: '' })).toBe(true)
  expect(validatePlanInput({ ...input, learningBlockerDetails: 'x'.repeat(240) })).toBe(true)
  expect(validatePlanInput({ ...input, learningBlockerDetails: 'x'.repeat(241) })).toBe(false)
  expect(validatePlanInput({ ...input, learningBlockerDetails: 12 })).toBe(false)
  expect(validatePlanInput({ ...input, learningBlocker: 'focus', learningBlockerDetails: 'Text' })).toBe(false)
})
it('sendet den Text ausschließlich an den serverseitigen Adapter und protokolliert ihn nicht', async () => {
  const text = 'PRIVATE-BLOCKER-TEXT'
  let sent
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const result = await handleLearningPlanRequest({ ...input, learningBlockerDetails: text }, {
    env: { AI_PROVIDER: 'groq', GROQ_MODEL: 'offline', GROQ_API_KEY: 'synthetic' },
    fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); return { ok: false, status: 429 } },
  })
  expect(JSON.parse(sent.messages[1].content).learningBlockerDetails).toBe(text)
  expect(result.body.error.category).toBe('provider_http_error')
  expect(JSON.stringify([result, log.mock.calls])).not.toContain(text)
})
it('behält Mock-Rückfragen bei und verwendet die Lernhürde', async () => {
  const result = await handleLearningPlanRequest({ ...input, learningBlockerDetails: 'Unterlagen sind unsortiert.' }, { env: { AI_PROVIDER: 'mock' } })
  expect(result.status).toBe(200)
  expect(result.body.clarifyingQuestion).toBeTruthy()
  expect(result.body.plan.steps[0].description).toContain('Unterlagen sind unsortiert.')
})
