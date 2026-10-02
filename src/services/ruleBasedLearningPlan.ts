import type {
  LearningPlan,
  LearningPlanRequest,
  LearningStep,
} from '../types/learningPlan'
import { createLearningPlanId } from '../types/learningPlan'

const stepIdeas = [
  { title: 'Klarheit schaffen', verb: 'Formuliere das Lernziel für dich in einem Satz und lege die passenden Unterlagen bereit.', kind: 'preparation' },
  { title: 'Thema verstehen', verb: 'Verschaffe dir einen Überblick und arbeite den wichtigsten Teil konzentriert durch.', kind: 'learning' },
  { title: 'Aktiv üben', verb: 'Wende das Gelernte an: löse eine Aufgabe oder erkläre den Kern mit eigenen Worten.', kind: 'practice' },
  { title: 'Wissen abrufen', verb: 'Schau kurz weg und notiere, woran du dich erinnerst. Ergänze danach die Lücken.', kind: 'learning' },
  { title: 'Sauber abschließen', verb: 'Halte deinen wichtigsten Aha-Moment und eine offene Frage fest.', kind: 'reflection' },
  { title: 'Kurz wiederholen', verb: 'Fasse die Kerngedanken zusammen und entscheide, was du als Nächstes vertiefst.', kind: 'reflection' },
] as const

const energyLead = {
  low: 'In deinem Tempo: ',
  medium: '',
  high: 'Nutze deinen Fokus: ',
} as const

const blockerGuidance = {
  starting: { stepIndex: 0, text: 'Starte mit einer einzigen kleinen Frage, statt das ganze Thema auf einmal anzugehen.' },
  understanding: { stepIndex: 1, text: 'Notiere den unklarsten Begriff und formuliere dazu eine konkrete Frage.' },
  focus: { stepIndex: 2, text: 'Schalte Ablenkungen aus und arbeite bis zum Timer-Ende nur an diesem Schritt.' },
  time: { stepIndex: 2, text: 'Wähle nur den wichtigsten Teil des Themas und bleibe bei diesem Mini-Ziel.' },
  other: { stepIndex: 0, text: 'Überlege kurz, welche kleine Veränderung dir den Einstieg erleichtern würde.' },
} as const

export function generateRuleBasedLearningPlan(input: LearningPlanRequest): LearningPlan {
  const planId = createLearningPlanId()
  const count = Math.min(6, Math.max(2, Math.ceil(input.timeBudgetMinutes / 10)))
  const topic = input.goal.trim().replace(/[.!?]+$/, '')
  const answerHint = input.clarification && !input.clarification.skipped
    ? ` Schwerpunkt aus deiner Antwort: „${input.clarification.answer}“.`
    : ''
  const baseMinutes = Math.floor(input.timeBudgetMinutes / count)
  const extraMinutes = input.timeBudgetMinutes % count
  const guidance = input.learningBlocker ? blockerGuidance[input.learningBlocker] : null
  const guidanceIndex = guidance ? Math.min(guidance.stepIndex, count - 1) : -1

  const steps: LearningStep[] = Array.from({ length: count }, (_, index) => {
    const idea = stepIdeas[index % stepIdeas.length]
    const blockerHint = index === guidanceIndex && guidance ? ` ${guidance.text}` : ''
    return {
      id: `${planId}-step-${index + 1}`,
      title: idea.title,
      description: `${energyLead[input.energyLevel]}${idea.verb}${blockerHint} Dein Thema: „${topic}“.${answerHint}`,
      minutes: baseMinutes + (index < extraMinutes ? 1 : 0),
      kind: idea.kind,
      done: false,
    }
  })

  return { ...input, id: planId, steps }
}
