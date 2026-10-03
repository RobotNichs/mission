// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import {
  cosmeticShopItems,
  DEFAULT_BACKGROUND_ID,
  GAMIFICATION_STORAGE_KEY,
} from './services/gamification'
import { initialGamificationState } from './types/gamification'
import type { LearningPlanRequest, LearningStepKind } from './types/learningPlan'

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})

afterEach(() => vi.restoreAllMocks())

async function createMission(task: string, minutes: number) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), {
    target: { value: task },
  })
  fireEvent.change(screen.getByLabelText('Wie viel Zeit hast du?'), {
    target: { value: String(minutes) },
  })
  fireEvent.click(screen.getByRole('button', { name: /Mission planen|Mission aktualisieren/ }))
  await waitFor(() => expect(document.querySelector('.summary-copy p')?.textContent).toBe(task))
}

function getStepMinutes() {
  return screen.getAllByText(/^\d+ min$/).reduce((total, element) => {
    return total + Number.parseInt(element.textContent ?? '0', 10)
  }, 0)
}

function mockPlanResponse(
  input: LearningPlanRequest,
  clarifyingQuestion: string | null,
  stepSpecs: Array<{ title: string; kind: LearningStepKind; description: string }>,
  planId = 'mock-final-plan',
) {
  const baseMinutes = Math.floor(input.timeBudgetMinutes / stepSpecs.length)
  const extraMinutes = input.timeBudgetMinutes % stepSpecs.length
  return {
    source: 'mock',
    clarifyingQuestion,
    plan: {
      id: planId,
      goal: input.goal,
      timeBudgetMinutes: input.timeBudgetMinutes,
      energyLevel: input.energyLevel,
      learningBlocker: input.learningBlocker,
      steps: stepSpecs.map((step, index) => ({
        id: `server-${planId}-step-${index}`,
        ...step,
        minutes: baseMinutes + (index < extraMinutes ? 1 : 0),
        done: false,
      })),
    },
  }
}

function installLearningPlanApiMock(
  responseFor: (request: LearningPlanRequest, callIndex: number) => unknown,
) {
  const requests: LearningPlanRequest[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as LearningPlanRequest
    requests.push(request)
    return {
      ok: true,
      json: async () => responseFor(request, requests.length),
    } as Response
  })
  return requests
}

describe('aktiver Lernplan und Formulareingaben', () => {
  it('hält den 15-Minuten-Plan samt Label und Timer aktiv, wenn der Entwurf auf 5 Minuten geändert wird', async () => {
    const { unmount } = render(<App />)
    await createMission('SQL-JOINs üben', 15)

    fireEvent.change(screen.getByLabelText('Wie viel Zeit hast du?'), {
      target: { value: '5' },
    })

    expect((screen.getByLabelText('Wie viel Zeit hast du?') as HTMLSelectElement).value).toBe('5')
    expect(screen.getByText('15 MIN').textContent).toBe('15 MIN')
    expect(getStepMinutes()).toBe(15)
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('15:00')
    expect(document.querySelector('.summary-copy p')?.textContent).toBe('SQL-JOINs üben')

    unmount()
    render(<App />)

    expect((screen.getByLabelText('Wie viel Zeit hast du?') as HTMLSelectElement).value).toBe('5')
    expect(screen.getByText('15 MIN').textContent).toBe('15 MIN')
    expect(getStepMinutes()).toBe(15)
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('15:00')
  })

  it('wendet die neue Zeit erst beim Aktualisieren an, stoppt den Timer und erhält passende Häkchen', async () => {
    render(<App />)
    await createMission('SQL-JOINs üben', 15)
    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(firstCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))

    fireEvent.change(screen.getByLabelText('Wie viel Zeit hast du?'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))

    await waitFor(() => expect(screen.getByText('5 MIN').textContent).toBe('5 MIN'))
    expect(screen.getByText('5 MIN').textContent).toBe('5 MIN')
    expect(getStepMinutes()).toBe(5)
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('05:00')
    expect(screen.getByRole('button', { name: /Start/ })).toBeTruthy()
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true)
  })

  it('setzt erledigte Schritte zurück, wenn beim Aktualisieren das Lernziel geändert wird', async () => {
    render(<App />)
    await createMission('SQL-JOINs üben', 15)
    fireEvent.click(screen.getAllByRole('checkbox')[0])

    fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), {
      target: { value: 'Python-Funktionen üben' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))

    await waitFor(() => expect(document.querySelector('.summary-copy p')?.textContent).toBe('Python-Funktionen üben'))
    expect(document.querySelector('.summary-copy p')?.textContent).toBe('Python-Funktionen üben')
    expect(screen.getAllByRole('checkbox').every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true)
  })

  it('hält aktiven Plan, Häkchen, Timer und Fokuszeit während einer offenen Rückfrage unverändert', async () => {
    render(<App />)
    await createMission('SQL-JOINs üben', 15)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    const oldMission = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null').mission
    const timerBefore = screen.getByLabelText(/Verbleibende Zeit:/).textContent
    const focusBefore = JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null').totalFocusMilliseconds
    installLearningPlanApiMock((request) => mockPlanResponse(request, 'Welcher Teil der Mathematik?', [
      { title: 'Mathematik verstehen', description: 'Arbeite ein konkretes mathematisches Beispiel durch.', kind: 'learning' },
    ]))

    fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), {
      target: { value: 'Mathematik' },
    })
    fireEvent.change(screen.getByLabelText('Wie viel Zeit hast du?'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))

    expect(await screen.findByRole('heading', { name: 'Welcher Teil der Mathematik?' })).toBeTruthy()
    const savedWhileWaiting = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null')
    expect(savedWhileWaiting.mission.id).toBe(oldMission.id)
    expect(savedWhileWaiting.mission.goal).toBe(oldMission.goal)
    expect(savedWhileWaiting.mission.timeBudgetMinutes).toBe(15)
    expect(savedWhileWaiting.mission.steps[0].done).toBe(true)
    expect(screen.getByText('15 MIN').textContent).toBe('15 MIN')
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toBe(timerBefore)
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null').totalFocusMilliseconds).toBe(focusBefore)
    expect((screen.getByLabelText('Wie viel Zeit hast du?') as HTMLSelectElement).disabled).toBe(true)
  })

  it('übernimmt die Antwort in genau eine finale Anfrage und erstellt passende Schritte', async () => {
    const requests = installLearningPlanApiMock((request) => request.clarification
      ? mockPlanResponse(request, null, [
          { title: 'Bruchgleichungen umformen', description: 'Forme eine Bruchgleichung um und prüfe die Definitionsmenge.', kind: 'practice' },
        ])
      : mockPlanResponse(request, 'Welcher Teil der Mathematik?', [
          { title: 'Mathematik erkunden', description: 'Wähle einen passenden mathematischen Begriff.', kind: 'learning' },
        ]))
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), { target: { value: 'Mathematik' } })
    fireEvent.click(screen.getByRole('button', { name: /Mission planen/ }))
    await screen.findByRole('heading', { name: 'Welcher Teil der Mathematik?' })
    fireEvent.change(screen.getByLabelText(/Deine Antwort/), { target: { value: 'Bruchgleichungen' } })
    fireEvent.click(screen.getByRole('button', { name: /Antwort senden/ }))

    await waitFor(() => expect(document.querySelector('.summary-copy p')?.textContent).toBe('Mathematik'))
    expect(requests).toHaveLength(2)
    expect(requests[1].clarification).toEqual({
      question: 'Welcher Teil der Mathematik?',
      answer: 'Bruchgleichungen',
      skipped: false,
    })
    expect(document.querySelector('.steps-list')?.textContent).toContain('Bruchgleichungen')
    expect(screen.queryByRole('heading', { name: 'Welcher Teil der Mathematik?' })).toBeNull()
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('25:00')
  })

  it('überspringt die Rückfrage explizit und erhält trotzdem einen finalen Plan ohne weitere Frage', async () => {
    const requests = installLearningPlanApiMock((request) => mockPlanResponse(
      request,
      request.clarification ? null : 'Welcher Teil der Mathematik?',
      [{ title: 'Mathematischen Kern lernen', description: 'Arbeite einen konkreten mathematischen Lehrsatz durch.', kind: 'learning' }],
    ))
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), { target: { value: 'Mathematik' } })
    fireEvent.click(screen.getByRole('button', { name: /Mission planen/ }))
    await screen.findByRole('heading', { name: 'Welcher Teil der Mathematik?' })
    fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }))

    await waitFor(() => expect(document.querySelector('.summary-copy p')?.textContent).toBe('Mathematik'))
    expect(requests).toHaveLength(2)
    expect(requests[1].clarification).toEqual({
      question: 'Welcher Teil der Mathematik?',
      answer: '',
      skipped: true,
    })
    expect(screen.queryByRole('heading', { name: 'Welcher Teil der Mathematik?' })).toBeNull()
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('25:00')
  })

  it('fällt bei einem Netzwerkfehler nach der Antwort lokal zurück und verwendet den Antwortschwerpunkt', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async (_url, init) => {
        const request = JSON.parse(String(init?.body))
        return {
          ok: true,
          json: async () => mockPlanResponse(request, 'Welcher Teil der Mathematik?', [
            { title: 'Mathematik erkunden', description: 'Lies einen Überblick.', kind: 'learning' },
          ]),
        } as Response
      })
      .mockRejectedValueOnce(new Error('offline'))
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' }), { target: { value: 'Mathematik' } })
    fireEvent.click(screen.getByRole('button', { name: /Mission planen/ }))
    await screen.findByRole('heading', { name: 'Welcher Teil der Mathematik?' })
    fireEvent.change(screen.getByLabelText(/Deine Antwort/), { target: { value: 'Bruchgleichungen' } })
    fireEvent.click(screen.getByRole('button', { name: /Antwort senden/ }))

    await waitFor(() => expect(document.querySelector('.summary-copy p')?.textContent).toBe('Mathematik'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(document.querySelector('.generation-notice')?.textContent).toContain('lokaler Ersatzplan')
    expect(document.querySelector('.steps-list')?.textContent).toContain('Bruchgleichungen')
    expect(screen.queryByRole('heading', { name: 'Welcher Teil der Mathematik?' })).toBeNull()
  })

  it('vergibt beim Abhaken keine Coins oder Orbs, wenn dieselbe aktive Mission aktualisiert oder Schritte erneut abgehakt werden', async () => {
    render(<App />)
    await createMission('Java-Objekte üben', 10)
    const [firstStep, secondStep] = screen.getAllByRole('checkbox') as HTMLInputElement[]

    fireEvent.click(firstStep)
    expect(JSON.parse(localStorage.getItem('mission.gamification.v1') ?? 'null').totalFocusMilliseconds).toBe(0)
    fireEvent.click(firstStep)
    fireEvent.click(firstStep)
    expect(JSON.parse(localStorage.getItem('mission.gamification.v1') ?? 'null').totalFocusMilliseconds).toBe(0)

    fireEvent.click(secondStep)
    const completedState = JSON.parse(localStorage.getItem('mission.gamification.v1') ?? 'null')
    const missionId = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null').mission.id
    expect(completedState.totalFocusMilliseconds).toBe(0)
    expect(completedState.coins).toBe(0)
    expect(completedState.ownedOrbIds).toHaveLength(0)
    const rewardDialog = screen.getByRole('dialog', { name: 'Starker Abschluss.' })
    expect(rewardDialog.textContent).toContain('Alle Schritte erledigt')
    expect(rewardDialog.textContent).not.toContain('XP')
    expect(rewardDialog.textContent).not.toContain('freigeschaltet')
    fireEvent.click(screen.getByRole('button', { name: 'Weiterlernen' }))

    fireEvent.change(screen.getByLabelText('Wie viel Zeit hast du?'), {
      target: { value: '15' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))
    await waitFor(() => expect(screen.getByText('15 MIN').textContent).toBe('15 MIN'))
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getAllByRole('checkbox')[0])

    const afterRechecking = JSON.parse(localStorage.getItem('mission.gamification.v1') ?? 'null')
    const updatedMissionId = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null').mission.id
    expect(updatedMissionId).toBe(missionId)
    expect(afterRechecking.totalFocusMilliseconds).toBe(0)
    expect(afterRechecking.coins).toBe(0)
    expect(afterRechecking.ownedOrbIds).toHaveLength(0)

    cleanup()
    render(<App />)
    expect(screen.queryByRole('dialog', { name: 'Starker Abschluss.' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('mission.gamification.v1') ?? 'null').totalFocusMilliseconds).toBe(0)
  })

  it('erhält die Schrittzuordnung ohne Belohnung auch bei veränderten IDs und neu formulierten Titeln', async () => {
    render(<App />)
    await createMission('Java-Vererbung verstehen', 15)
    const oldMission = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null').mission
    const rewardedLearningStep = oldMission.steps.find((step: { kind: string }) => step.kind === 'learning')
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(rewardedLearningStep.title) }))
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null').totalFocusMilliseconds).toBe(0)

    installLearningPlanApiMock((request) => mockPlanResponse(request, null, [
      { title: 'Vererbungskonzepte abrufen', description: 'Erkläre Vererbung und überschreiben an einem Java-Beispiel.', kind: 'learning' },
      { title: 'Unterklassen implementieren', description: 'Implementiere eine Unterklasse und teste dynamisches Binden.', kind: 'practice' },
    ], 'regenerated-plan-id'))
    fireEvent.click(screen.getByRole('button', { name: /Mission aktualisieren/ }))
    await screen.findByText('Vererbungskonzepte abrufen')

    const updatedMission = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null').mission
    expect(updatedMission.id).toBe(oldMission.id)
    expect(updatedMission.steps[0].id).toBe(rewardedLearningStep.id)
    expect(updatedMission.steps[0].done).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /Vererbungskonzepte abrufen/ }))
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null').totalFocusMilliseconds).toBe(0)
  })

  it('bietet alle optionalen Lernblockaden an und speichert die Auswahl im aktiven Plan', async () => {
    render(<App />)
    const blockerSelect = screen.getByLabelText('Was hindert dich gerade am Lernen?') as HTMLSelectElement
    expect(Array.from(blockerSelect.options).map((option) => option.textContent)).toEqual([
      'Keine Auswahl',
      'Ich weiß nicht, wo anfangen',
      'Ich verstehe das Thema nicht',
      'Ich kann mich nicht konzentrieren',
      'Ich habe zu wenig Zeit',
      'Sonstiges',
    ])
    fireEvent.change(blockerSelect, { target: { value: 'focus' } })

    await createMission('SQL-JOINs üben', 20)

    const storedState = JSON.parse(localStorage.getItem('mission.saved-mission.v1') ?? 'null')
    expect(storedState.form.learningBlocker).toBe('focus')
    expect(storedState.mission.learningBlocker).toBe('focus')
    expect(document.querySelector('.steps-list')?.textContent).toContain('Schalte Ablenkungen aus')
  })

  it('rüstet nur freigeschaltete Orbs aus und behält den Core-Look nach einem Reload', () => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({
      ...initialGamificationState,
      ownedOrbIds: ['orb-common'],
    }))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }))
    expect(document.querySelector('.mission-core')?.classList.contains('core-orb-common')).toBe(true)
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null').equippedOrbId).toBe('orb-common')

    cleanup()
    render(<App />)
    expect(document.querySelector('.mission-core')?.classList.contains('core-orb-common')).toBe(true)
    expect((screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
  })

  it('bestätigt Kistenkäufe und erhält alte Kosmetik samt aktivem Design nach Reload', () => {
    const item = cosmeticShopItems.find((candidate) => candidate.kind === 'background')!
    const coreEffect = cosmeticShopItems.find((candidate) => candidate.kind === 'core-effect')!
    vi.spyOn(Math, 'random').mockReturnValue(0)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({
      ...initialGamificationState, coins: 60, ownedCosmeticIds: [item.id, coreEffect.id],
      selectedBackgroundId: item.id, selectedCoreEffectId: coreEffect.id,
    }))
    render(<App />)
    expect(screen.queryByRole('heading', { name: 'Coin-Shop' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
    expect(screen.getByRole('alertdialog', { name: 'Orb-Kiste kaufen?' })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!).coins).toBe(60)
    fireEvent.click(screen.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Animation überspringen' }))
    expect(screen.getByRole('dialog', { name: 'Morgenlicht' }).textContent).toContain('Neu freigeschaltet')
    expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!).coins).toBe(30)
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }))
    cleanup()
    render(<App />)
    const saved = JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
    expect(saved.coins).toBe(30)
    expect(saved.ownedCosmeticIds).toEqual([item.id, coreEffect.id])
    expect(saved.equippedOrbId).toBe('orb-common')
    expect(saved.selectedBackgroundId).not.toBe(DEFAULT_BACKGROUND_ID)
    expect(document.querySelector('.app-shell')?.classList.contains('theme-' + item.id)).toBe(true)
    expect(document.querySelector('.mission-core')?.classList.contains('core-effect-' + coreEffect.id)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('erhält vorhandene Orbs beim Abschluss ohne neuen Drop oder Coins', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({
      ...initialGamificationState,
      ownedOrbIds: ['orb-common'],
    }))
    render(<App />)
    await createMission('Java-Schleifen üben', 5)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getAllByRole('checkbox')[1])

    const dialog = screen.getByRole('dialog', { name: 'Starker Abschluss.' })
    expect(dialog.textContent).toContain('Alle Schritte erledigt')
    expect(dialog.textContent).not.toContain('XP')
    const state = JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY) ?? 'null')
    expect(state.ownedOrbIds).toEqual(['orb-common'])
    expect(state.totalFocusMilliseconds).toBe(0)
    expect(state.coins).toBe(0)
    expect(state.claimedMissionIds).toHaveLength(1)
  })

  it.each([
    {
      description: 'flat gespeicherter Lernplan',
      state: {
        task: 'Java-Objekte verstehen', minutes: 15, energy: 'medium', remainingSeconds: 840,
        steps: [{ id: 'a', title: 'Thema verstehen', description: 'Übersicht', minutes: 8, done: true }, { id: 'b', title: 'Aktiv üben', description: 'Üben', minutes: 7, done: false }],
      },
    },
    {
      description: 'Lernplan aus dem getrennten Zwischenformat',
      state: {
        form: { task: 'Java-Objekte verstehen', minutes: 5, energy: 'high' },
        mission: {
          task: 'Java-Objekte verstehen', minutes: 15, energy: 'medium',
          steps: [{ id: 'a', title: 'Thema verstehen', description: 'Übersicht', minutes: 8, done: true }, { id: 'b', title: 'Aktiv üben', description: 'Üben', minutes: 7, done: false }],
        },
        remainingSeconds: 840,
      },
    },
  ])('lädt weiterhin einen $description', ({ state }) => {
    localStorage.setItem('mission.saved-mission.v1', JSON.stringify(state))
    render(<App />)

    expect(document.querySelector('.summary-copy p')?.textContent).toBe('Java-Objekte verstehen')
    expect(screen.getByText('15 MIN').textContent).toBe('15 MIN')
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('14:00')
    expect((screen.getByLabelText('Wie viel Zeit hast du?') as HTMLSelectElement).value).toBe(
      'form' in state ? '5' : '15',
    )
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true)
  })
})
