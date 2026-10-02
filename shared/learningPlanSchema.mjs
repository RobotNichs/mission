const energies = new Set(['low', 'medium', 'high'])
const blockers = new Set(['starting', 'understanding', 'focus', 'time', 'other'])
const stepKinds = new Set(['learning', 'practice', 'preparation', 'reflection'])
const learningKinds = new Set(['learning', 'practice'])
const validSources = new Set(['mock', 'groq'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function validQuestion(question) {
  if (question === null) return true
  if (typeof question !== 'string') return false
  const trimmed = question.trim()
  return trimmed.length > 0
    && trimmed.length <= 160
    && (trimmed.match(/\?/g) ?? []).length === 1
}

function words(value) {
  return new Set(value
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) ?? [])
}

function isTopicSpecific(goal, topicFocus) {
  if (typeof topicFocus !== 'string' || topicFocus.trim().length === 0 || topicFocus.length > 120) return false
  const goalWords = words(goal)
  return [...words(topicFocus)].some((word) => goalWords.has(word))
}

export function validatePlanInput(value) {
  return isRecord(value)
    && Object.keys(value).every((key) => ['goal', 'timeBudgetMinutes', 'energyLevel', 'learningBlocker', 'clarification'].includes(key))
    && typeof value.goal === 'string'
    && value.goal.trim().length > 0
    && value.goal.length <= 280
    && Number.isInteger(value.timeBudgetMinutes)
    && value.timeBudgetMinutes >= 5
    && value.timeBudgetMinutes <= 60
    && value.timeBudgetMinutes % 5 === 0
    && energies.has(value.energyLevel)
    && (value.learningBlocker === null || blockers.has(value.learningBlocker))
    && (value.clarification === undefined || (
      hasExactKeys(value.clarification, ['question', 'answer', 'skipped'])
      && validQuestion(value.clarification.question)
      && typeof value.clarification.answer === 'string'
      && value.clarification.answer.length <= 120
      && typeof value.clarification.skipped === 'boolean'
      && (value.clarification.skipped
        ? value.clarification.answer.trim().length === 0
        : value.clarification.answer.trim().length > 0)
    ))
}

export function validateAiPlanDraft(value, input) {
  if (!hasExactKeys(value, ['clarifyingQuestion', 'steps']) || !validQuestion(value.clarifyingQuestion)) return false
  if (input.clarification && value.clarifyingQuestion !== null) return false
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 12) return false

  let totalMinutes = 0
  let hasLearningActivity = false
  for (const step of value.steps) {
    if (!hasExactKeys(step, ['title', 'description', 'minutes', 'kind', 'topicFocus'])) return false
    if (typeof step.title !== 'string' || step.title.trim().length === 0 || step.title.length > 90) return false
    if (typeof step.description !== 'string' || step.description.trim().length === 0 || step.description.length > 600) return false
    if (!Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > input.timeBudgetMinutes) return false
    const topicContext = input.clarification && !input.clarification.skipped
      ? `${input.goal} ${input.clarification.answer}`
      : input.goal
    if (!stepKinds.has(step.kind) || !isTopicSpecific(topicContext, step.topicFocus)) return false
    if (learningKinds.has(step.kind)) hasLearningActivity = true
    totalMinutes += step.minutes
  }

  return totalMinutes === input.timeBudgetMinutes && hasLearningActivity
}

export function validateLearningPlanResponse(value, input) {
  if (!hasExactKeys(value, ['source', 'clarifyingQuestion', 'plan'])) return false
  if (!validSources.has(value.source) || !validQuestion(value.clarifyingQuestion) || !isRecord(value.plan)) return false
  if (input.clarification && value.clarifyingQuestion !== null) return false

  const plan = value.plan
  if (!hasExactKeys(plan, ['id', 'goal', 'timeBudgetMinutes', 'energyLevel', 'learningBlocker', 'steps'])) return false
  if (typeof plan.id !== 'string' || plan.id.trim().length === 0) return false
  if (
    plan.goal !== input.goal
    || plan.timeBudgetMinutes !== input.timeBudgetMinutes
    || plan.energyLevel !== input.energyLevel
    || plan.learningBlocker !== input.learningBlocker
    || !Array.isArray(plan.steps)
    || plan.steps.length < 1
    || plan.steps.length > 12
  ) return false

  let totalMinutes = 0
  let hasLearningActivity = false
  for (const step of plan.steps) {
    if (!hasExactKeys(step, ['id', 'title', 'description', 'minutes', 'kind', 'done'])) return false
    if (typeof step.id !== 'string' || step.id.trim().length === 0) return false
    if (typeof step.title !== 'string' || step.title.trim().length === 0 || step.title.length > 90) return false
    if (typeof step.description !== 'string' || step.description.trim().length === 0 || step.description.length > 600) return false
    if (!Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > input.timeBudgetMinutes) return false
    if (!stepKinds.has(step.kind) || typeof step.done !== 'boolean') return false
    if (learningKinds.has(step.kind)) hasLearningActivity = true
    totalMinutes += step.minutes
  }

  return totalMinutes === input.timeBudgetMinutes && hasLearningActivity
}
