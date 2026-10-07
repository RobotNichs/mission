import { screen, within } from '../services/testNavigation'
// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LongTermProjects from './LongTermProjects'
import App from '../App'
import { createTestLocks } from '../services/testLocks'
import { MOBILE_QUERY } from '../services/useMobileLayout'
import { createProject, projectId, saveProject, loadProjects } from '../services/longTermProjects'
import { createFallbackRoadmap, type ProjectInput } from '../../shared/longTermProjectSchema.mjs'
const input:ProjectInput={title:'Japanisch lernen',goal:'Japanisch im Alltag',startingLevel:{type:'beginner'},duration:{type:'fixed-days',days:30},weeklyMinutes:120,daysPerWeek:3,learningContext:{}}
beforeEach(()=>{localStorage.clear();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function click(name:string) {fireEvent.click(screen.getByRole('button',{name}))}
function change(name:string,value:string) {fireEvent.change(screen.getByLabelText(name),{target:{value}})}
function seed() {const p=createProject(input,createFallbackRoadmap(input,projectId));saveProject(p);return p}
it('öffnet nur die aktuelle Phase mit echten Meilenstein-Zählern und hält Lernstand kompakt', () => {
 const p=seed();render(<LongTermProjects enabled/>);click(p.title+' · Aktiv')
 const buttons=screen.getAllByRole('button',{name:/Meilensteine erledigt/})
 expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
 buttons.slice(1).forEach(b=>expect(b.getAttribute('aria-expanded')).toBe('false'))
 expect(buttons[0].textContent).toContain('0 / '+p.roadmap.phases[0].milestones.length)
 expect(document.querySelector('.project-detail progress')).toBeNull()
 fireEvent.click(buttons[1]);expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
 fireEvent.click(buttons[1]);expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
 expect(loadProjects().projects[0].id).toBe(p.id)
})
it('priorisiert nach bestätigtem Meilenstein eine spätere offene Phase ohne Gesamtprozent', () => {
 const p=seed();p.roadmap.phases[0].milestones.forEach(m=>{m.status='completed'});saveProject(p)
 render(<LongTermProjects enabled/>);click(p.title+' · Aktiv')
 const buttons=screen.getAllByRole('button',{name:/Meilensteine erledigt/})
 expect(buttons[0].getAttribute('aria-expanded')).toBe('false');expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
 expect(buttons[0].textContent).toContain('Abgeschlossen')
})
it('erstellt ein Projekt in drei Schritten und zeigt nur das aktuelle Formular',async()=>{
 render(<LongTermProjects enabled/>);click('Langzeitprojekt erstellen');expect(screen.queryByLabelText('Vorwissen')).toBeNull();change('Projekttitel','Japanisch lernen');change('Dein langfristiges Ziel','Japanisch im Alltag');click('Weiter');expect(screen.queryByLabelText('Projekttitel')).toBeNull();expect((screen.getByLabelText('Vorwissen') as HTMLSelectElement).value).toBe('beginner');click('Weiter');change('Zeithorizont','open-ended');change('Wochenzeit in Minuten (30–4.200)','155');click('Roadmap erstellen und speichern');await screen.findByRole('heading',{name:'Japanisch lernen'});expect(loadProjects().projects[0].duration).toEqual({type:'open-ended'});expect(loadProjects().projects[0].weeklyMinutes).toBe(155);expect(screen.getByText(/lokaler, generischer/)).toBeTruthy();expect(screen.queryByRole('button',{name:/Tägliche Mission/})).toBeNull()
})
it('bearbeitet Roadmap und Reihenfolge ohne KI und bewahrt IDs',()=>{
 const p=seed();render(<LongTermProjects enabled/>);click('Japanisch lernen · Aktiv');click('Projekt bearbeiten');change('Projekttitel','Mein Japanisch');click('Weiter');change('Vorwissen','custom');change('Eigene Ausgangslage (max. 300 Zeichen)','Ich lese Hiragana');click('Weiter');fireEvent.click(screen.getByText('Roadmap bearbeiten'));const first=screen.getAllByRole('group',{name:/^Phase /})[0];fireEvent.change(within(first).getByLabelText('Phasentitel'),{target:{value:'Mein Einstieg'}});fireEvent.click(within(first).getByRole('button',{name:'Meilenstein hinzufügen'}));fireEvent.change(within(first).getAllByLabelText('Meilensteintitel')[1],{target:{value:'Eigene kleine Etappe'}});fireEvent.click(within(first).getAllByRole('button',{name:'Meilenstein nach oben'})[1]);fireEvent.click(within(first).getAllByRole('button',{name:'Meilenstein löschen'})[1]);fireEvent.click(within(first).getByRole('button',{name:'Phase nach unten'}));change('Projektstatus','paused');click('Projekt speichern');const saved=loadProjects().projects[0];expect(saved.id).toBe(p.id);expect(saved.status).toBe('paused');expect(saved.roadmap.phases[1].title).toBe('Mein Einstieg');expect(saved.roadmap.phases[1].id).toBe(p.roadmap.phases[0].id);expect(saved.roadmap.phases[1].milestones[0].title).toBe('Eigene kleine Etappe');expect(fetch).not.toHaveBeenCalled()
})
it('fehlende Schreibsperre verhindert Änderungen',()=>{render(<LongTermProjects enabled={false}/>);expect((screen.getByRole('button',{name:'Langzeitprojekt erstellen'}) as HTMLButtonElement).disabled).toBe(true)})
it('Speicherfehler lässt den Entwurf zur Korrektur offen',async()=>{render(<LongTermProjects enabled/>);click('Langzeitprojekt erstellen');change('Projekttitel','Japanisch');change('Dein langfristiges Ziel','Japanisch lernen');click('Weiter');click('Weiter');const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Speicher voll')});click('Roadmap erstellen und speichern');await screen.findByText('Speicher voll');expect(screen.getByRole('button',{name:'Roadmap erstellen und speichern'})).toBeTruthy();spy.mockRestore()})
it('mobile Bibliothek enthält Projekte ohne zusätzlichen Navigationseintrag und schützt die Mission',async()=>{
 vi.stubGlobal('innerWidth',390);vi.stubGlobal('matchMedia',vi.fn((query:string)=>({matches:query===MOBILE_QUERY,media:query,addEventListener:vi.fn(),removeEventListener:vi.fn()})));Object.defineProperty(navigator,'locks',{configurable:true,value:createTestLocks()});localStorage.setItem('mission.onboarding.v1',JSON.stringify({version:1,status:'dismissed'}));
 render(<App/>);const nav=within(screen.getByRole('navigation',{name:'Mobile Hauptnavigation'}));expect(nav.getAllByRole('button')).toHaveLength(6);fireEvent.click(nav.getByRole('button',{name:'Projekte'}));await waitFor(()=>expect((screen.getByRole('button',{name:'Langzeitprojekt erstellen'}) as HTMLButtonElement).disabled).toBe(false));const before=localStorage.getItem('mission.saved-mission.v1');click('Langzeitprojekt erstellen');change('Projekttitel','Japanisch');change('Dein langfristiges Ziel','Japanisch lernen');click('Weiter');click('Weiter');click('Roadmap erstellen und speichern');await screen.findByRole('heading',{name:'Japanisch'});expect(localStorage.getItem('mission.saved-mission.v1')).toBe(before);expect(nav.getAllByRole('button')).toHaveLength(6)
})
