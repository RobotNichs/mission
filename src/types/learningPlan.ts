export type EnergyLevel = 'low' | 'medium' | 'high'

export const learningBlockerOptions = [
  { value: 'starting', label: 'Ich weiß nicht, wo anfangen' },
  { value: 'understanding', label: 'Ich verstehe das Thema nicht' },
  { value: 'focus', label: 'Ich kann mich nicht konzentrieren' },
  { value: 'time', label: 'Ich habe zu wenig Zeit' },
  { value: 'other', label: 'Sonstiges' },
] as const

export type LearningBlocker = typeof learningBlockerOptions[number]['value']
export type LearningStepKind = 'learning' | 'practice' | 'preparation' | 'reflection'

export type LearningStep = {
  id: string
  title: string
  description: string
  minutes: number
  kind: LearningStepKind
  done: boolean
}

export type LearningPlan = {
  id: string
  goal: string
  timeBudgetMinutes: number
  energyLevel: EnergyLevel
  learningBlocker: LearningBlocker | null
  steps: LearningStep[]
}

export type LearningPlanInput = Omit<LearningPlan, 'id' | 'steps'>
export type LearningPlanClarification = {
  question: string
  answer: string
  skipped: boolean
}
export type LearningPlanRequest = LearningPlanInput & {
  clarification?: LearningPlanClarification
}
export type LearningPlanGenerator = (input: LearningPlanInput) => Promise<LearningPlan>

export function createLearningPlanId(): string {
  const uniquePart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `mission-${uniquePart}`
}
