export const environmentOptions = [
  ['school', 'Schule'], ['university', 'Universität'], ['training', 'Ausbildung'],
  ['work', 'Beruf'], ['private', 'Privat'], ['other', 'Sonstiges'],
]
export const purposeOptions = [
  ['exam', 'Klausur / Prüfung'], ['homework', 'Hausaufgabe'], ['project', 'Projekt'],
  ['revision', 'Wiederholung'], ['new-topic', 'Neues Thema'], ['interest', 'Persönliches Interesse'], ['other', 'Sonstiges'],
]
export const materialOptions = [
  ['slides', 'Vorlesungsfolien'], ['script', 'Skript'], ['book', 'Buch'],
  ['worksheets', 'Übungsblätter'], ['notes', 'Eigene Notizen'], ['online', 'Online-Unterlagen'],
  ['tasks', 'Aufgaben / Altklausuren'], ['none', 'Keine Materialien'], ['other', 'Sonstiges'],
]
export const MAX_CONTEXT_DETAILS = 240

export function validateLearningContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (Object.keys(value).some(key => !['environment', 'purpose', 'materials', 'materialsDetails'].includes(key))) return false
  if (value.environment !== undefined && !environmentOptions.some(([id]) => id === value.environment)) return false
  if (value.purpose !== undefined && !purposeOptions.some(([id]) => id === value.purpose)) return false
  if (value.materials !== undefined && (!Array.isArray(value.materials) || value.materials.length > materialOptions.length
    || new Set(value.materials).size !== value.materials.length || value.materials.some(id => !materialOptions.some(([key]) => key === id))
    || (value.materials.includes('none') && value.materials.length !== 1))) return false
  return value.materialsDetails === undefined || (value.materials?.includes('other') === true && typeof value.materialsDetails === 'string'
    && value.materialsDetails.length <= MAX_CONTEXT_DETAILS && !/<\/?[a-z][^>]*>|<!--|[\u0000-\u001f]/i.test(value.materialsDetails))
}

// Whitelist and copy; malformed optional context must not discard an old mission.
export function readLearningContext(value) {
  if (!validateLearningContext(value)) return undefined
  return {
    ...(value.environment !== undefined ? { environment: value.environment } : {}),
    ...(value.purpose !== undefined ? { purpose: value.purpose } : {}),
    ...(value.materials !== undefined ? { materials: [...value.materials] } : {}),
    ...(value.materialsDetails !== undefined ? { materialsDetails: value.materialsDetails.trim() } : {}),
  }
}

export function needsMaterialQuestion(input) {
  return !input.clarification && !input.learningContext?.materials?.length
    && /\b(aufgaben|altklausur|musterlösung|übungsblatt|arbeitsblatt)\b/i.test(input.goal)
    && ['starting', 'understanding'].includes(input.learningBlocker)
}

function availableMaterials(input) {
  const selected = input.learningContext?.materials
  if (selected?.length) return selected
  if (input.clarification && !input.clarification.skipped && /material|unterlagen/i.test(input.clarification.question)) {
    if (/keine|nichts/i.test(input.clarification.answer)) return ['none']
    return materialOptions.filter(([id, label]) => id !== 'none' && id !== 'other'
      && input.clarification.answer.toLocaleLowerCase('de').includes(label.split(' / ')[0].toLocaleLowerCase('de'))).map(([id]) => id)
  }
  return []
}

export function hasNoMaterials(input) { return availableMaterials(input).includes('none') }

// Conservative detection of direct assumptions, not semantic resource checking.
// Conditional suggestions and creation of new notes are not claims of ownership.
const resourcePatterns = [
  ['slides', /\b(vorlesungsfolien|folien|slides)\b/iu], ['script', /\b(skript|skripte|script)\b/iu],
  ['book', /\b([\p{L}]*buch|bucher|book)\b/iu], ['worksheets', /\b(ubungsblatt\w*|ubungsblatter\w*|arbeitsblatt\w*|arbeitsblatter\w*)\b/iu],
  ['tasks', /\b(altklausur\w*)\b/iu], ['online', /\b(online-unterlagen)\b/iu],
  ['notes', /\b(eigene[nr]? notizen)\b/iu], ['solution', /\b(musterlosung\w*)\b/iu],
]
export function unavailableMaterialStep(steps, input) {
  const normalize = text => text.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const materials = availableMaterials(input)
  const none = materials.includes('none')
  const suppliedText = normalize([input.goal, input.learningContext?.materialsDetails ?? '', input.clarification?.skipped ? '' : input.clarification?.answer ?? ''].join(' '))
  return steps.findIndex(step => [step.title, ...step.description.split(/[.!?;\n]+/)].some(clause => {
    const text = normalize(clause)
    if (/\b(falls|wenn|sofern)\b.*\b(vorhanden|verfugbar|hast)\b/iu.test(text)) return false
    const imperative = /\b(offne|offnen|nutze|nutzen|schlage|schlagen|lies|lesen|wahle|wahlen|suche|suchen)\b/iu.test(text)
    if (!imperative) return false
    if (none && /\b(unterlagen|materialien|skript|buch|vorlesungsfolien|musterlosung|altklausur|ubungsblatt)\b/iu.test(text)) return true
    return resourcePatterns.some(([id, pattern]) => pattern.test(text) && !materials.includes(id) && (none || !pattern.test(suppliedText)))
  }))
}

// Organises work only; no subject facts or assumed institutional resources.
export function personalizeContextAction(description, input, index, kind, last = false) {
  const context = input.learningContext
  const materials = availableMaterials(input)
  const none = materials.includes('none')
  let action = description
  if (none) {
    action = index === 0
      ? 'Notiere genau eine kleine Frage zu deinem Lernziel. Versuche eine erste Antwort aus dem Gedächtnis in eigenen Worten.'
      : kind === 'reflection' ? 'Notiere eine offene Frage und deine nächste kleine Handlung.'
      : kind === 'learning' ? 'Erkläre einen kleinen Teil deines Lernziels in eigenen Worten. Markiere, was du noch nicht erklären kannst.'
      : 'Versuche nur einen kleinen eigenen Ansatz zu deiner ausgewählten Frage. Halte am ersten unklaren Schritt an.'
  } else if (materials.length) {
    const names = materialOptions.filter(([id]) => materials.includes(id) && id !== 'other').map(([, label]) => label)
    const source = names.length ? `dein angegebenes Material (${names.join(', ')})` : 'dein angegebenes Material'
    const suffix = names.length ? ` (${names.join(', ')})` : ''
    action = action.replace(/deine vorhandenen Unterlagen|deine Unterlagen/g, `dein angegebenes Material${suffix}`)
      .replace(/deinen vorhandenen Unterlagen|deinen Unterlagen/g, `deinem angegebenen Material${suffix}`)
      .replace(/deiner Unterlagen/g, `deines angegebenen Materials${suffix}`)
    if (index === 0) action = `Nutze ${source}. ${action}`
    if (materials.includes('other') && context?.materialsDetails?.trim() && index === 0) action += ` Deine Materialangabe: „${context.materialsDetails.trim()}“.`
  }
  if (context?.purpose === 'project' && kind === 'practice') action = 'Setze nur den nächsten kleinen Teil deines Projekts um. Prüfe anschließend diesen einen Teil; notiere Hindernisse statt weitere Aufgaben hinzuzufügen.'
  if (index === 0) {
    const blocker = {
      starting: none ? 'Beginne mit genau einer Frage, ohne Vorbereitung.' : 'Wähle genau einen kleinen Abschnitt deines verfügbaren Materials.',
      understanding: none ? 'Formuliere genau eine unklare Stelle als Frage; versuche eine eigene Erklärung.' : 'Vollziehe nur den ersten Schritt eines vorhandenen Beispiels nach, statt mehrere Aufgaben zu bearbeiten.',
      focus: 'Schließe ablenkende Tabs; bearbeite nur eine Handlung ohne Kontextwechsel.',
      time: 'Priorisiere nur die wichtigste Handlung und lasse weniger relevante Teile weg.',
    }[input.learningBlocker]
    if (blocker && context !== undefined) action += ` ${blocker}`
    const purpose = {
      exam: 'Wähle den wichtigsten prüfungsrelevanten Teil; strebe keine vollständige Vorbereitung an.',
      homework: 'Wähle genau einen kleinen Teil deiner Hausaufgabe.',
      project: 'Lege einen kleinen, konkret umsetzbaren nächsten Projektschritt fest.',
      revision: 'Rufe zuerst aus dem Gedächtnis ab, was du schon weißt, und wähle eine Lücke.',
      'new-topic': 'Beginne mit genau einer Frage und einer kleinen Kernaussage zum neuen Thema.',
      interest: 'Wähle eine Frage, die dich interessiert; ohne Prüfungsdruck.',
    }[context?.purpose]
    if (purpose) action += ` ${purpose}`
    if (context?.environment === 'work') action += 'Wähle eine kleine Anwendung aus deinem Arbeitsalltag, ohne vertrauliche Daten zu verwenden.'
  }
  if (last && context?.purpose === 'exam') action += 'Prüfe ohne Nachlesen, was du jetzt erklären kannst; notiere eine verbleibende Lücke.'
  return action
}
