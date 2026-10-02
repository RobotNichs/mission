# Mission

Mission ist ein responsiver Lernplaner mit React, TypeScript und Vite. Im Standardmodus liefert ein lokaler Mock-Endpunkt Beispielpläne; bei Ausfall bleibt der regelbasierte Browser-Generator als Fallback verfügbar. Es werden keine Anbieter-SDKs benötigt.

## Voraussetzungen

- Node.js 20.19 oder neuer (Vite 7)
- npm

## Lokal starten

1. Öffne dieses Projekt im Terminal.
2. Installiere die Abhängigkeiten: `npm install`
3. Starte Vite mit API-Mock: `npm run dev`
4. Öffne die im Terminal angezeigte Adresse, normalerweise `http://localhost:5173`.

Mit `Strg+C` wird der Entwicklungsserver beendet. Für einen Produktionsbuild: `npm run build`; danach serviert `npm start` die gebaute App und API unter `http://localhost:3000`. Auch `npm run preview` enthält den Mock-Endpunkt.

## KI-Anbieter optional aktivieren

Der Standard ist `AI_PROVIDER=mock`; dabei wird kein externer Modellanbieter kontaktiert und es entstehen keine Modellkosten. Für einen späteren Groq-Test kann `.env.example` lokal nach `.env` kopiert und serverseitig konfiguriert werden:

- `AI_PROVIDER=groq`
- `GROQ_MODEL` auf eine aktuell unterstützte, kostengünstige Modell-ID setzen
- `GROQ_API_KEY` nur in der lokalen `.env` oder der Server-Umgebung setzen

Die `.env` wird von Git ignoriert. Der Browser erhält den Schlüssel nicht; er wird weder in `VITE_`-Variablen noch im `localStorage` abgelegt. Kosten entstehen nur bei aktivem Groq-Modus und tatsächlichen Anfragen nach dem aktuellen Tarif des Anbieters. Es wird kein Schlüssel mitgeliefert oder angefordert.

Der Endpunkt `POST /api/learning-plan` prüft Eingaben und Modellantworten gegen ein festes Schema: höchstens eine kurze Rückfrage, mindestens ein Lern- oder Übungsschritt, thematischer Bezug und Schrittzeiten, die exakt das Zeitbudget ergeben. Bei Netzwerk-, Anbieter- oder Schemafehlern zeigt die Oberfläche eine Meldung und erzeugt lokal einen Fallback-Plan. Der lokale Node-Server bindet standardmäßig an `127.0.0.1` und begrenzt API-Anfragen pro IP.

## Funktionen

- Lernziel und Zeitbudget von 5 bis 60 Minuten eingeben
- Energielevel und optionale Lernblockade wählen
- Thematische Mock-/KI-Lernpläne mit lokalem Fallback erzeugen
- Lernschritte abhaken und den Fortschritt verfolgen
- Countdown starten, pausieren und zurücksetzen
- Einstellungen, Schritte und verbleibende Zeit lokal im Browser speichern (localStorage)
- XP, Level, Coins und Orb-Sammlung; Belohnungen bleiben einmalig pro Schritt/Mission
- Freigeschaltete Orbs ausrüsten und Mission Core damit optisch verändern
- Kosmetische Hintergründe und Core-Effekte nur mit erspielten Coins kaufen; vor jedem Kauf wird bestätigt
- Dark-Theme mit reduzierten Animationen bei `prefers-reduced-motion`

Es gibt keine Anmeldung und keine Datenbank. Lernpläne und Gamification-Daten bleiben lokal im Browser; beim Löschen der Browserdaten werden sie entfernt. Der API-Schlüssel ist ausschließlich Serverkonfiguration.

Ausgerüstete Orbs, gekaufte Kosmetik und aktive Darstellungen werden gemeinsam mit XP, Coins und der Sammlung in `mission.gamification.v1` gespeichert. Popups für Missionsbelohnungen sind nur für das gerade abgeschlossene Ereignis sichtbar und werden nach einem Reload nicht erneut geöffnet.

## Wichtige Projektdateien

- `src/App.tsx`: Oberfläche, aktiver Plan, Timer und Speicherung
- `src/services/learningPlanApi.ts`: Browseraufruf, Antwortvalidierung und Fallback
- `src/services/ruleBasedLearningPlan.ts`: vorhandener lokaler Generator
- `shared/learningPlanSchema.mjs`: gemeinsames festes Ein-/Ausgabeschema
- `server/learningPlanApi.mjs`: Mock- und Groq-Adapter sowie serverseitige Validierung
- `server/index.mjs`: Vite-Middleware und lokaler Produktionsserver
- `server/learningPlanApi.test.mjs`: Mock-, Schema-, Provider- und Fehlerfälle
