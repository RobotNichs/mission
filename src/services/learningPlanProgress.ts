import type { LearningStep } from '../types/learningPlan'

export function getStableStepRewardSlot(steps: LearningStep[], stepIndex: number): string {
  const step = steps[stepIndex]
  if (!step) return 'unknown:1'
  const ordinal = steps.slice(0, stepIndex + 1).filter((candidate) => candidate.kind === step.kind).length
  return `${step.kind}:${ordinal}`
}

export function preserveStepProgress(
  generatedSteps: LearningStep[],
  previousSteps: LearningStep[],
  preserveMission: boolean,
  missionId: string,
  claimedStepRewardKeys: string[],
): LearningStep[] {
  if (!preserveMission || previousSteps.length === 0) {
    return generatedSteps.map((step) => ({ ...step, done: false }))
  }

  const availablePrevious = new Set(previousSteps.map((_, index) => index))
  const matches = new Map<number, number>()
  const normalizedTitle = (title: string) => title.trim().toLocaleLowerCase('de')
  const hasClaimedReward = (previousIndex: number) => {
    const step = previousSteps[previousIndex]
    return claimedStepRewardKeys.includes(`${missionId}::${step.id}`)
      || claimedStepRewardKeys.includes(`${missionId}::slot:${getStableStepRewardSlot(previousSteps, previousIndex)}`)
  }

  generatedSteps.forEach((step, generatedIndex) => {
    const matchIndex = previousSteps.findIndex((previous, previousIndex) => (
      availablePrevious.has(previousIndex)
      && previous.kind === step.kind
      && normalizedTitle(previous.title) === normalizedTitle(step.title)
    ))
    if (matchIndex >= 0) {
      matches.set(generatedIndex, matchIndex)
      availablePrevious.delete(matchIndex)
    }
  })

  generatedSteps.forEach((step, generatedIndex) => {
    if (matches.has(generatedIndex)) return
    const sameKind = [...availablePrevious]
      .filter((previousIndex) => previousSteps[previousIndex].kind === step.kind)
      .sort((left, right) => Number(hasClaimedReward(right)) - Number(hasClaimedReward(left))
        || Math.abs(left - generatedIndex) - Math.abs(right - generatedIndex))[0]
    if (sameKind !== undefined) {
      matches.set(generatedIndex, sameKind)
      availablePrevious.delete(sameKind)
    }
  })

  generatedSteps.forEach((_step, generatedIndex) => {
    if (matches.has(generatedIndex)) return
    const positional = availablePrevious.has(generatedIndex) ? generatedIndex : [...availablePrevious]
      .sort((left, right) => Number(hasClaimedReward(right)) - Number(hasClaimedReward(left))
        || Math.abs(left - generatedIndex) - Math.abs(right - generatedIndex))[0]
    if (positional !== undefined) {
      matches.set(generatedIndex, positional)
      availablePrevious.delete(positional)
    }
  })

  return generatedSteps.map((step, generatedIndex) => {
    const previous = matches.get(generatedIndex)
    if (previous === undefined) return { ...step, done: false }
    const previousStep = previousSteps[previous]
    const sameTitle = normalizedTitle(previousStep.title) === normalizedTitle(step.title)
    return {
      ...step,
      id: previousStep.id,
      done: sameTitle && previousStep.done,
    }
  })
}
