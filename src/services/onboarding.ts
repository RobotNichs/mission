export const ONBOARDING_KEY = 'mission.onboarding.v1'
export type TourStatus = 'offered' | 'completed' | 'skipped'
export function shouldOfferTour(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === null
      && localStorage.getItem('mission.saved-mission.v1') === null
      && localStorage.getItem('mission.gamification.v1') === null
  } catch { return false }
}
export function saveTourStatus(status: TourStatus): void {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, status })) } catch { /* Tour remains usable without storage. */ }
}
export const tourSteps = [
  { title: 'Deine Mission', text: 'Lege fest, was du lernen möchtest und wie viel Zeit du hast. Mission hilft dir beim Einstieg.' },
  { title: 'Dein Lernplan', text: 'Die KI kann dir kleine Schritte vorschlagen. Du kannst jeden Schritt bearbeiten oder deinen Plan komplett selbst erstellen.' },
  { title: 'Fokuszeit', text: 'Starte deine Fokuszeit, pausiere bei Bedarf oder nutze die freie Stoppuhr.' },
  { title: 'Mission Core', text: 'Dein Orb begleitet dich beim Lernen. Fokuszeit erhöht dein Level und bringt dir Coins. Langfristig schaltest du Prestige-Belohnungen frei.' },
  { title: 'Orb-Sammlung', text: 'Mit deinen Fokus-Coins kannst du Kisten öffnen und neue Orbs sammeln. Die Sammlung erreichst du hier.' },
] as const
