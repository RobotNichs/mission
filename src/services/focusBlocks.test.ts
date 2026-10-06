// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { advanceFocusBlocks, blockSummary, createFocusBlocks, readFocusStrategy, restoreFocusBlocks, skipFocusBreak, validFocusStrategy, type FocusStrategy } from './focusBlocks'
import { addFocusTime, getLevel } from './gamification'
import { initialGamificationState } from '../types/gamification'
import { normalizeHistory } from './learningHistory'
import { exampleTemplates, templateFromPlan, missionFromTemplate, exportTemplate, importTemplate } from './missionTemplates'
import { applyPlanTiming, validateEditablePlan } from './planEditor'
import { getPrestige } from './prestige'

const strategy: FocusStrategy = { mode: 'pomodoro' }
describe('Fokusstrategien und lange lokale Missionen', () => {
  it.each([90, 120, 180])('plant %i Fokusminuten ohne KI-Limit', minutes => {
    const p = { ...missionFromTemplate(exampleTemplates[0]), timeMode: 'manual' as const, timeBudgetMinutes: minutes }
    expect(validateEditablePlan(p)).toBeNull(); expect(applyPlanTiming(p, 0).remainingSeconds).toBe(minutes * 60)
    expect(blockSummary(minutes, strategy).count).toBe(Math.ceil(minutes / 25))
    expect(blockSummary(minutes, strategy).totalMinutes).toBe(minutes + (Math.ceil(minutes / 25) - 1) * 5)
  })
  it('behält freien Countdown und alte Strategien bei', () => {
    expect(createFocusBlocks(1200)).toBeNull(); expect(readFocusStrategy(undefined)).toEqual({ mode: 'free' })
    expect(blockSummary(120)).toEqual({ count: 1, breaks: 0, pauseMinutes: 0, totalMinutes: 120 })
  })
  it.each([{ mode: 'pomodoro' }, { mode: '50-10' }, { mode: 'custom', focusMinutes: 10, breakMinutes: 1 }] as FocusStrategy[])('berechnet Strategie %j', s => {
    expect(validFocusStrategy(s)).toBe(true)
    const b = createFocusBlocks(3600, s)!
    expect(b.phase).toBe('focus'); expect(b.remainingMilliseconds).toBe(s.mode === 'pomodoro' ? 1500000 : s.mode === '50-10' ? 3000000 : 600000)
  })
  it.each([{}, null, { mode: 'bad' }, { mode: 'free', coins: 3 }, { mode: 'custom', focusMinutes: 9, breakMinutes: 1 },
    { mode: 'custom', focusMinutes: 121, breakMinutes: 1 }, { mode: 'custom', focusMinutes: 10, breakMinutes: 0 },
    { mode: 'custom', focusMinutes: 10, breakMinutes: 61 }, { mode: 'custom', focusMinutes: 10.5, breakMinutes: 5 },
    { mode: 'custom', focusMinutes: NaN, breakMinutes: 5 }, { mode: 'custom', focusMinutes: 10, breakMinutes: '5' },
  ])('weist ungültige Strategie %j zurück', s => expect(validFocusStrategy(s)).toBe(false))
  it('stoppt am Fokusende, vergütet keinen Überlauf und bereitet die Pause vor', () => {
    const first = advanceFocusBlocks(createFocusBlocks(3000, strategy)!, 1800000, 3000, strategy)
    expect(first.focusMilliseconds).toBe(1500000); expect(first.remainingSeconds).toBe(1500)
    expect(first.boundary).toBe(true); expect(first.blocks).toMatchObject({ phase: 'break', block: 1, completedBlocks: 1, remainingMilliseconds: 300000 })
  })
  it('Pause endet ohne Fokuszeit und bereitet nächsten Block vor', () => {
    const first = advanceFocusBlocks(createFocusBlocks(3000, strategy)!, 1500000, 3000, strategy)
    const next = advanceFocusBlocks(first.blocks, 600000, first.remainingSeconds, strategy)
    expect(next.focusMilliseconds).toBe(0); expect(next.remainingSeconds).toBe(1500)
    expect(next.blocks).toMatchObject({ phase: 'focus', block: 2, completedBlocks: 1, breakMilliseconds: 300000 })
  })
  it('überspringt nur die Pause ohne Zeitgutschrift', () => {
    const first = advanceFocusBlocks(createFocusBlocks(3000, strategy)!, 1500000, 3000, strategy)
    const next = skipFocusBreak(first.blocks, first.remainingSeconds, strategy)
    expect(next).toMatchObject({ phase: 'focus', block: 2, breakMilliseconds: 0 })
    expect(skipFocusBreak(next, 1500, strategy)).toEqual(next)
  })
  it('beendet den letzten und gegebenenfalls kürzeren Block ohne abschließende Pause', () => {
    const first = advanceFocusBlocks(createFocusBlocks(1800, strategy)!, 1500000, 1800, strategy)
    const next = skipFocusBreak(first.blocks, first.remainingSeconds, strategy)
    expect(next.remainingMilliseconds).toBe(300000)
    const final = advanceFocusBlocks(next, 300000, first.remainingSeconds, strategy)
    expect(final.blocks).toMatchObject({ phase: 'finished', completedBlocks: 2, remainingMilliseconds: 0 })
    expect(final.remainingSeconds).toBe(0)
    expect(advanceFocusBlocks(final.blocks, 60000, 0, strategy).focusMilliseconds).toBe(0)
  })
  it('beendet fragmentierte Millisekunden exakt ohne zusätzliche Mikro-Pause', () => {
    let blocks = createFocusBlocks(1500, strategy)!, remaining = 1500
    for (const elapsed of [1, 2, 3, 1499994]) {
      const result = advanceFocusBlocks(blocks, elapsed, remaining, strategy)
      blocks = result.blocks; remaining = result.remainingSeconds
    }
    expect(remaining).toBe(0); expect(blocks.phase).toBe('finished'); expect(blocks.completedBlocks).toBe(1)
  })
  it('zählt 25/5/25 als exakt 50 Fokusminuten und 5 Pausenminuten', () => {
    let b = createFocusBlocks(3000, strategy)!, remaining = 3000, game = initialGamificationState
    for (const elapsed of [1500000, 300000, 1500000]) {
      const result = advanceFocusBlocks(b, elapsed, remaining, strategy)
      b = result.blocks; remaining = result.remainingSeconds; game = addFocusTime(game, result.focusMilliseconds)
    }
    expect(game.coins).toBe(50); expect(game.totalFocusMilliseconds).toBe(3000000)
    expect(getLevel(game.totalFocusMilliseconds / 60000)).toBe(2)
    expect(b.breakMilliseconds).toBe(300000); expect(b.completedBlocks).toBe(2)
  })
  it('erhält Millisekundenfragmente über Blöcke und vergütet Grenzen nicht doppelt', () => {
    let game = addFocusTime(initialGamificationState, 59999)
    game = addFocusTime(game, advanceFocusBlocks(createFocusBlocks(1, strategy)!, 1, 1, strategy).focusMilliseconds)
    expect(game.coins).toBe(1); expect(game.totalFocusMilliseconds).toBe(60000)
  })
  it('verändert Prestige knapp unter der Schwelle nicht durch Pausen oder Blockwechsel', () => {
    const game = addFocusTime(initialGamificationState, 25 * 3600000 - 1)
    const pause = advanceFocusBlocks(createFocusBlocks(3000, strategy)!, 1500000, 3000, strategy).blocks
    const result = advanceFocusBlocks(pause, 300000, 1500, strategy)
    const unchanged = addFocusTime(game, result.focusMilliseconds)
    expect(unchanged.totalFocusMilliseconds).toBe(game.totalFocusMilliseconds)
    expect(unchanged.coins).toBe(game.coins)
    expect(getPrestige(unchanged.totalFocusMilliseconds).rank).toBe(0)
    expect(getPrestige(addFocusTime(unchanged, 1).totalFocusMilliseconds).rank).toBe(1)
  })
  it.each(['focus', 'break'] as const)('restauriert %s ohne Offline-Berechnung', phase => {
    const b = { ...createFocusBlocks(3000, strategy)!, phase, remainingMilliseconds: 10000 }
    expect(restoreFocusBlocks(JSON.parse(JSON.stringify(b)), 3000, strategy)).toEqual(b)
  })
  it('behandelt beschädigte Blockdaten sicher und verändert keinen Fortschritt', () => {
    const before = JSON.stringify(initialGamificationState)
    for (const raw of [null, {}, { phase: 'break', remainingMilliseconds: -1 }, { phase: 'finished', remainingMilliseconds: Infinity }]) expect(restoreFocusBlocks(raw, 1500, strategy)).toEqual(createFocusBlocks(1500, strategy))
    expect(JSON.stringify(initialGamificationState)).toBe(before)
  })
  it('erhält automatische Zeit und ignoriert Intervalle im Stoppuhr-Timervertrag', () => {
    const p = missionFromTemplate(exampleTemplates[0])
    expect(applyPlanTiming(p, 60).remainingSeconds).toBe(1740)
    expect(applyPlanTiming({ ...p, timeMode: 'stopwatch', focusStrategy: strategy }, 60).remainingSeconds).toBe(0)
  })
  it('erhält alte Historie und optionale Strategiemetadaten', () => {
    const old = { id: 'one', startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T11:00:00Z', goal: 'SQL', focusSeconds: 3000, plannedSeconds: 3000, timeMode: 'manual', completedSteps: 1, totalSteps: 2, status: 'completed' }
    expect(normalizeHistory([old])[0]).toEqual(old)
    expect(normalizeHistory([{ ...old, focusStrategy: strategy, completedFocusBlocks: 2, breakSeconds: 300 }])[0]).toMatchObject({ focusSeconds: 3000, breakSeconds: 300, completedFocusBlocks: 2 })
  })
  it('exportiert Strategie als Vorlagendaten, niemals Blockfortschritt', () => {
    const plan = { ...missionFromTemplate(exampleTemplates[0]), focusStrategy: strategy }
    const t = templateFromPlan(plan, { title: 'SQL', description: '', language: 'de', category: 'Informatik', origin: 'custom', tags: [] })
    const raw = exportTemplate(t), fresh = missionFromTemplate(importTemplate(raw))
    expect(fresh.focusStrategy).toEqual(strategy); expect(fresh.id).not.toBe(plan.id)
    expect(raw).not.toMatch(/completedBlocks|remainingMilliseconds|breakMilliseconds/)
    expect(missionFromTemplate(exampleTemplates[0]).focusStrategy).toBeUndefined()
  })
})
