import { validateSourceProject, readSourceProject } from './sourceProject.mjs'
import { validateProjectMissionContext, projectSource, unnecessaryKnownTopic } from './projectMissionContext.mjs'
import { readLearningContext, validateLearningContext, unavailableMaterialStep } from './learningContext.mjs'
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

// This is an explicit text reference, not a semantic or factual correctness check.
// Ignore organisational words so that "lernen" alone cannot validate any topic.
const genericTopicWords = new Set(words('ich du wir sie er es ihr mir mich dich uns mein meine meinen dein deine ein eine einer eines einem einen der die das den dem des und oder aber auch mit ohne von vom zum zur zu im in am an auf aus fur als bei nach vor uber ist sind sein habe hat haben mochte mochten will wollen soll sollen kann konnen lernen lerne lernziel lernplan thema themen grundlagen grundlage machen mache verstehen uben ubung aufgabe aufgaben beispiel beispiele schritt schritte teil bereich unterlagen vorhandenen vorhandene bitte heute jetzt zuerst the a an and or to of learn learning study do'))
for (const word of words('verstehe versteht verstehst mache macht machst lernt lernst aufgabenstellung material materialien vorbereiten vorbereitung wiederholen wiederholung bearbeiten beginnen starten i me my you your we our want would like understand understanding make topic task tasks subject basics example examples notes practice prepare preparation review revision')) genericTopicWords.add(word)
for (const word of words('muss mussen brauche benotige meine meiner meinen meines unserer diese dieser dieses einen einer wichtig wichtige wichtigsten gezielt gezielte')) genericTopicWords.add(word)

// Only exact inflection variants of a full word, never substring or semantic matching.
function topicForms(word) {
  return [word, ...(word.length >= 8 && word.endsWith('en') ? [word.slice(0, -2)] : []), ...(word.length >= 6 && word.endsWith('s') ? [word.slice(0, -1)] : [])]
}

function hasTopicReference(goal, content) {
  const goalWords = new Set([...words(goal)].filter(word => !genericTopicWords.has(word) && !examWords.has(word) && /[a-z]/.test(word)))
  const stepWords = new Set([...words(content)].filter(word => !genericTopicWords.has(word)).flatMap(topicForms))
  return [...goalWords].some(word => topicForms(word).some(form => stepWords.has(form)))
}

function normalized(value) { return value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
const examWords = new Set(['klausur', 'klausuren', 'klausurvorbereitung', 'prufung', 'prufungen', 'prufungsvorbereitung', 'prufungsstoff', 'exam', 'exams', 'examination'])
const examOrganizationWords = new Set(['stoff', 'stoffauswahl', 'lernstoff', 'lernen', 'lernblock', 'vorbereiten', 'vorbereitung', 'vorbereitet', 'priorisierung', 'priorisieren', 'wiederholung', 'vor', 'morgen'])
function isGeneralExamGoal(context) {
  const tokens = [...words(context)]
  return tokens.some(word => examWords.has(word)) && tokens.every(word => genericTopicWords.has(word) || examWords.has(word) || examOrganizationWords.has(word) || /^\d+$/.test(word))
}

// A small organisational vocabulary, not a dictionary of academic subtopics.
const coachingPatterns = [
  /\b(unterlagen|material|materialien|stoff|lernstoff|beispiels?|beispielen|beispielaufgabe|aufgabe|aufgaben|notes|materials|examples?|exercise)\b.*\b(offnen|offne|suchen|suche|finden|finde|wahlen|wahle|auswahlen|markieren|markiere|bearbeiten|bearbeite|nachvollziehen|versuchen|versuche|priorisieren|priorisiere|open|find|choose|try)\b/,
  /\b(offnen|offne|suchen|suche|finden|finde|wahlen|wahle|auswahlen|markieren|markiere|bearbeiten|bearbeite|nachvollziehen|versuchen|versuche|priorisieren|priorisiere|open|find|choose|try)\b.*\b(unterlagen|material|materialien|stoff|lernstoff|beispiels?|beispielen|beispielaufgabe|aufgabe|aufgaben|notes|materials|examples?|exercise)\b/,
  /\b(ergebnis|losung|verstandnis|wissen|selbstprufung|self|result|solution)\b.*\b(prufen|prufe|vergleichen|vergleiche|abrufen|testen|check|compare|test)\b|\b(prufen|prufe|vergleichen|vergleiche|abrufen|testen|check|compare|test)\b.*\b(ergebnis|losung|verstandnis|wissen|result|solution)\b/,
  /\b(notiz|notizen|frage|fragen|lucken|zusammenfassung|nachsten|nachster|nachste|notes|questions|summary|next)\b.*\b(notieren|notiere|festhalten|erstellen|planen|plane|sichern|schreiben|schreibe|write|plan|record)\b|\b(notieren|notiere|festhalten|erstellen|planen|plane|sichern|schreiben|schreibe|write|plan|record)\b.*\b(notiz|notizen|frage|fragen|lucken|zusammenfassung|nachsten|nachster|nachste|notes|questions|summary|next)\b/,
  /\b(selbstprufung|stoffauswahl|priorisierung|zusammenfassung)\b/,
]
function isCoachingStep(step) { return coachingPatterns.some(pattern => pattern.test(normalized(`${step.title} ${step.description}`))) }

// Limited detection of explicitly named subject switches. This is not semantics.
// Unknown synonyms/subjects may escape detection; these markers never grant validity.
const namedSubjects = [
  /\b(java|javascript|python)\b/, /\b(sql|joins?)\b/, /\b(statistik|statistics)\b/,
  /\b(exponentialfunktionen?|mathematik|mathematics)\b/, /\b(photosynthese|photosynthesis|biologie|biology)\b/,
  /\b(franzosisch\w*|french)\b/, /\b(astronomie|astronomy|sternbild|sterne)\b/,
  /\b(chemie|chemistry)\b/, /\b(physik|physics)\b/, /\b(geschichte|history)\b/,
]
function hasUnrequestedSubject(context, step) {
  const source = normalized(context), content = normalized(`${step.topicFocus} ${step.title} ${step.description}`)
  return namedSubjects.some(pattern => pattern.test(content) && !pattern.test(source))
}

function diagnosePlanTopic(steps, context) {
  const generalExam = isGeneralExamGoal(context)
  const content = steps.map(s => `${s.topicFocus} ${s.title} ${s.description}`).join(' ')
  if (generalExam) {
    // Organisational context belongs to the plan, not every individual wording.
    // Keep explicit unrequested subjects forbidden in every step.
    const foreign = steps.findIndex(s => hasUnrequestedSubject(context, s))
    if (foreign >= 0) return foreign
    return steps.some(isCoachingStep) ? null : -1
  }
  if (!hasTopicReference(context, content)) return -1
  const foreign = steps.findIndex(s => hasUnrequestedSubject(context, s))
  return foreign < 0 ? null : foreign
}

export function validatePlanInput(value) {
  return isRecord(value)
    && Object.keys(value).every((key) => ['goal', 'timeBudgetMinutes', 'energyLevel', 'learningBlocker', 'learningBlockerDetails', 'clarification', 'learningContext', 'projectContext'].includes(key))
    && (value.projectContext === undefined || (validateProjectMissionContext(value.projectContext) && value.goal === value.projectContext.goal && JSON.stringify(readLearningContext(value.learningContext)) === JSON.stringify(readLearningContext(value.projectContext.learningContext))))
    && (value.learningContext === undefined || validateLearningContext(value.learningContext))
    && (value.learningBlockerDetails === undefined || (value.learningBlocker === 'other' && typeof value.learningBlockerDetails === 'string' && value.learningBlockerDetails.length <= 240))
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

export function diagnoseAiPlanDraftDetails(value, input) {
  const errors = []
  const add = (schemaCode, field, stepIndex) => {
    if (errors.length < 8 && !errors.some(error => error.schemaCode === schemaCode)) errors.push({ schemaCode, ...(field ? { field } : {}), ...(stepIndex !== undefined ? { stepIndex } : {}) })
  }
  if (!hasExactKeys(value, ['clarifyingQuestion', 'steps'])) { add('invalid_response_structure'); return errors }
  if (!validQuestion(value.clarifyingQuestion)) add('invalid_question', 'clarifyingQuestion')
  if ((input.clarification || input.projectContext) && value.clarifyingQuestion !== null) add('followup_question_forbidden', 'clarifyingQuestion')
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 12) { add('invalid_step_count', 'steps'); return errors }
  let totalMinutes = 0
  let allMinutesValid = true
  let allKindsValid = true
  let allTopicFieldsValid = true
  let hasLearningActivity = false
  for (const [stepIndex, step] of value.steps.entries()) {
    if (!hasExactKeys(step, ['title', 'description', 'minutes', 'kind', 'topicFocus'])) {
      add('invalid_response_structure', 'steps', stepIndex); allMinutesValid = false; allKindsValid = false; allTopicFieldsValid = false; continue
    }
    const titleValid = typeof step.title === 'string' && step.title.trim().length > 0 && step.title.length <= 90
    const descriptionValid = typeof step.description === 'string' && step.description.trim().length > 0 && step.description.length <= 600
    if (!titleValid) add('invalid_step_title', 'title', stepIndex)
    if (!descriptionValid) add('invalid_step_description', 'description', stepIndex)
    if (!Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > input.timeBudgetMinutes) {
      add('invalid_step_minutes', 'minutes', stepIndex); allMinutesValid = false
    } else totalMinutes += step.minutes
    if (!stepKinds.has(step.kind)) { add('invalid_step_type', 'kind', stepIndex); allKindsValid = false }
    const focusValid = typeof step.topicFocus === 'string' && step.topicFocus.trim().length > 0 && step.topicFocus.length <= 120
    if (!focusValid) add('topic_reference_missing', 'topicFocus', stepIndex)
    if (!focusValid || !titleValid || !descriptionValid) allTopicFieldsValid = false
    if (learningKinds.has(step.kind)) hasLearningActivity = true
  }
  if (allTopicFieldsValid) {
    const topicContext = input.clarification && !input.clarification.skipped ? `${input.goal} ${input.clarification.answer}` : input.goal
    const projectTopic = input.projectContext ? topicContext + ' ' + input.projectContext.phase.title + ' ' + input.projectContext.phase.milestones.map(m=>m.title).join(' ') : topicContext
    const topicError = diagnosePlanTopic(value.steps, projectTopic)
    if (topicError !== null) add('topic_reference_missing', topicError < 0 ? 'steps' : undefined, topicError < 0 ? undefined : topicError)
    const materialError = unavailableMaterialStep(value.steps, input)
    if (materialError >= 0) add('material_reference_unavailable', 'description', materialError)
  }
  if (allMinutesValid && allTopicFieldsValid && unnecessaryKnownTopic(value.steps,input) >= 0) add('known_topic_replanned','title',unnecessaryKnownTopic(value.steps,input))
  if (allMinutesValid && totalMinutes !== input.timeBudgetMinutes) add('minutes_total_mismatch', 'minutes')
  if (allKindsValid && !hasLearningActivity) add('learning_activity_missing', 'kind')
  return errors
}

export function diagnoseAiPlanDraft(value, input) {
  return diagnoseAiPlanDraftDetails(value, input)[0]?.schemaCode ?? null
}

// Advisory checks only: wording cannot reliably establish pedagogical quality.
export function diagnosePlanQuality(value) {
  if (!Array.isArray(value?.steps) || !value.steps.length) return []
  const warnings = []
  const action = /\b(offne|suche|markiere|notiere|schreibe|bearbeite|rechne|berechne|lies|lese|vergleiche|versuche|fuhre|zeichne|decke|open|find|read|write|mark|try|compare|solve)\b/
  const normalized = text => typeof text === 'string' ? (text.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? []).join(' ') : ''
  if (!action.test(normalized(value.steps[0].description))) warnings.push('concrete_start_unclear')
  const signatures = value.steps.map(s => normalized(`${s.title} ${s.description}`))
  if (new Set(signatures).size < signatures.length) warnings.push('repeated_step_text')
  if (value.steps.some(s => s.minutes <= 5 && (normalized(s.description).match(/\b(und|and|danach|anschliessend|then)\b/g) ?? []).length >= 3)) warnings.push('short_step_overload_possible')
  return warnings
}

export function validateAiPlanDraft(value, input) {
  return diagnoseAiPlanDraft(value, input) === null
}

export function validateLearningPlanResponse(value, input) {
  if (!hasExactKeys(value, ['source', 'clarifyingQuestion', 'plan'])) return false
  if (!validSources.has(value.source) || !validQuestion(value.clarifyingQuestion) || !isRecord(value.plan)) return false
  if ((input.clarification || input.projectContext) && value.clarifyingQuestion !== null) return false

  const plan = value.plan
  if (!hasExactKeys(plan, ['id', 'goal', 'timeBudgetMinutes', 'energyLevel', 'learningBlocker', 'steps', ...(Object.hasOwn(plan, 'learningContext') ? ['learningContext'] : []), ...(Object.hasOwn(plan,'sourceProject') ? ['sourceProject'] : [])])) return false
  if (plan.sourceProject !== undefined && !validateSourceProject(plan.sourceProject)) return false
  if (JSON.stringify(readSourceProject(plan.sourceProject)) !== JSON.stringify(input.projectContext ? projectSource(input.projectContext) : undefined)) return false
  if (plan.learningContext !== undefined && !validateLearningContext(plan.learningContext)) return false
  if (JSON.stringify(readLearningContext(plan.learningContext)) !== JSON.stringify(readLearningContext(input.learningContext))) return false
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

  return totalMinutes === input.timeBudgetMinutes && hasLearningActivity && unnecessaryKnownTopic(plan.steps,input) < 0 && unavailableMaterialStep(plan.steps, input) < 0
}
