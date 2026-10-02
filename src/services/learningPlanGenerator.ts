import type { LearningPlanGenerator } from '../types/learningPlan'
import { generateLearningPlanWithStatus } from './learningPlanApi'

export { generateRuleBasedLearningPlan } from './ruleBasedLearningPlan'
export { generateLearningPlanWithStatus } from './learningPlanApi'

// Bestehender einfacher Generator-Vertrag bleibt für Aufrufer ohne Statusdetails erhalten.
export const generateLearningPlan: LearningPlanGenerator = async (input) => {
  const result = await generateLearningPlanWithStatus(input)
  return result.plan
}
