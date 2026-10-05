import { createLearningPlanId, type LearningPlan, type LearningPlanRequest, type LearningStepKind } from '../types/learningPlan'

// Integer allocation, retaining at least one minute per action and the exact budget.
export function allocateFallbackMinutes(budget: number, weights: number[]): number[] {
  if (!Number.isInteger(budget) || !weights.length || budget < weights.length || weights.some(w => !Number.isFinite(w) || w <= 0)) throw new RangeError('Ungültige Zeitverteilung.')
  const remaining = budget - weights.length, sum = weights.reduce((n, w) => n + w, 0)
  const exact = weights.map(w => remaining * w / sum)
  const minutes = exact.map(n => Math.floor(n) + 1)
  const order = exact.map((n, i) => ({ i, fraction: n - Math.floor(n) })).sort((a, b) => b.fraction - a.fraction || a.i - b.i)
  const missing = budget - minutes.reduce((n, m) => n + m, 0)
  for (let i = 0; i < missing; i++) minutes[order[i].i]++
  return minutes
}

export function generateRuleBasedLearningPlan(input: LearningPlanRequest): LearningPlan {
  const id = createLearningPlanId()
  const topic = input.goal.trim().replace(/[.!?]+$/, '')
  const shortTopic = topic.length > 44 ? `${topic.slice(0, 41)}…` : topic
  const focus = input.clarification && !input.clarification.skipped ? ` Schwerpunkt: „${input.clarification.answer.trim()}“.` : ''
  const energy = input.energyLevel === 'low' ? 'Bleibe bei einem kleinen Abschnitt und nur einem vorhandenen Beispiel.'
    : input.energyLevel === 'high' ? 'Versuche den nächsten Lösungs- oder Arbeitsschritt zuerst selbst, bevor du nachliest.'
    : 'Bearbeite einen begrenzten Abschnitt in deinem Tempo.'
  const obstacle = input.learningBlocker === 'starting' ? 'Öffne zuerst deine Unterlagen und suche genau eine passende Stelle.'
    : input.learningBlocker === 'understanding' ? 'Markiere den ersten unklaren Begriff und notiere dazu eine konkrete Frage.'
    : input.learningBlocker === 'focus' ? 'Schließe ablenkende Tabs. Bleibe während dieses Blocks bei genau einer Handlung.'
    : input.learningBlocker === 'time' ? 'Wähle nur die wichtigste vorhandene Aufgabe; lasse zusätzliche Themen weg.'
    : input.learningBlockerDetails ? `Deine Lernhürde: „${input.learningBlockerDetails.trim()}“. Wähle einen kleinen Einstieg.`
    : 'Lege nur die Unterlagen bereit, die du bereits hast.'
  const context = ` Für „${topic}“.${focus}`
  type Idea = { title: string; description: string; kind: LearningStepKind }
  const ideas: Idea[] = input.timeBudgetMinutes <= 10 ? [{
    title: `Erster Schritt: ${shortTopic}`, kind: 'practice',
    description: `Öffne deine vorhandenen Unterlagen und versuche nur den ersten Schritt eines passenden Beispiels. ${input.energyLevel === 'low' ? 'Eine kleine Stelle genügt.' : 'Prüfe diesen einen Schritt anhand der vorhandenen Lösung.'}`,
  }] : input.timeBudgetMinutes <= 20 ? [
    { title: `Stelle finden: ${shortTopic}`, description: 'Öffne deine vorhandenen Unterlagen und markiere genau ein passendes Beispiel.', kind: 'preparation' },
    { title: `Beispiel bearbeiten: ${shortTopic}`, description: input.learningBlocker === 'understanding' ? 'Vollziehe den ersten Arbeitsschritt des vorhandenen Beispiels nach und vergleiche ihn mit der Lösung.' : 'Versuche einen Arbeitsschritt des vorhandenen Beispiels selbst und prüfe ihn anschließend anhand deiner Unterlagen.', kind: 'practice' },
    { title: `Frage festhalten: ${shortTopic}`, description: 'Notiere eine offene Frage und die erste Handlung für deinen nächsten Lernblock.', kind: 'reflection' },
  ] : [
    { title: `Unterlagen öffnen: ${shortTopic}`, description: 'Öffne deine vorhandenen Unterlagen und suche den passenden Abschnitt. Wähle ein vorhandenes Beispiel.', kind: 'preparation' },
    { title: `Beispiel markieren: ${shortTopic}`, description: 'Lies einen kleinen Abschnitt. Markiere die dortige Definition oder Kernaussage und die zugehörige Beispielstelle.', kind: 'learning' },
    { title: `Beispiel nachvollziehen: ${shortTopic}`, description: 'Vollziehe genau ein vorhandenes Beispiel Schritt für Schritt nach. Halte am ersten unklaren Schritt an und vergleiche ihn mit deinen Unterlagen.', kind: 'practice' },
    { title: `Selbst versuchen: ${shortTopic}`, description: 'Versuche den ersten Schritt einer vorhandenen Aufgabe ohne Nachlesen. Prüfe anschließend deinen Ansatz anhand der vorhandenen Lösung, falls vorhanden.', kind: 'practice' },
    { title: `Nächsten Schritt sichern: ${shortTopic}`, description: 'Notiere eine offene Frage oder einen Fehler und die erste konkrete Handlung für deinen nächsten Lernblock.', kind: 'reflection' },
  ]
  if (input.learningBlocker === 'focus' && input.timeBudgetMinutes > 10) {
    const count = Math.max(3, Math.ceil(input.timeBudgetMinutes / 8))
    ideas.splice(0, ideas.length, ...Array.from({ length: count }, (_, i): Idea => i === 0
      ? { title: `Eine Stelle öffnen: ${shortTopic}`, description: 'Öffne genau ein vorhandenes Beispiel in deinen Unterlagen. Schließe ablenkende Tabs.', kind: 'preparation' }
      : i === count - 1 ? { title: `Offene Frage sichern: ${shortTopic}`, description: 'Notiere eine offene Frage und den nächsten kleinen Arbeitsschritt.', kind: 'reflection' }
      : { title: `Teil ${i}: ${shortTopic}`, description: i % 2 ? 'Bearbeite nur den nächsten einzelnen Arbeitsschritt deines ausgewählten Beispiels.' : 'Vergleiche nur den zuletzt bearbeiteten Schritt mit deinen vorhandenen Unterlagen und markiere eine unklare Stelle.', kind: i % 2 ? 'practice' : 'learning' }))
  }
  const weights = ideas.length === 1 ? [1] : input.learningBlocker === 'focus' ? ideas.map(() => 1)
    : ideas.length === 3 ? [1, 5, 1]
    : input.energyLevel === 'high' ? [1, 4, 9, 4, 2] : input.energyLevel === 'low' ? [2, 6, 6, 4, 2] : [1, 4, 7, 5, 2]
  const minutes = allocateFallbackMinutes(input.timeBudgetMinutes, weights)
  return { id, goal: input.goal, timeBudgetMinutes: input.timeBudgetMinutes, energyLevel: input.energyLevel, learningBlocker: input.learningBlocker,
    ...(input.learningBlockerDetails !== undefined ? { learningBlockerDetails: input.learningBlockerDetails } : {}),
    steps: ideas.map((idea, index) => ({ id: `${id}-step-${index + 1}`, title: idea.title, kind: idea.kind, done: false, minutes: minutes[index],
      description: `${idea.description}${context}${index === 0 ? ` ${obstacle} ${energy}` : ''}`.slice(0, 600) })) }
}
