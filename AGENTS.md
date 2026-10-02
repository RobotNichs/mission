# Entwicklungsanweisungen für Mission

Diese Datei gilt für das gesamte Mission-Projekt. Mission ist eine deutschsprachige, responsive React-/TypeScript-App mit Vite, einem serverseitigen Node-API-Endpunkt und einem kostenfreien Mock-Modus. Lernpläne und Gamification-Daten werden lokal im Browser gespeichert.

## Änderungsregeln

- Bestehende Funktionen, Nutzerabläufe, öffentliche Schnittstellen und Tests dürfen nicht ohne ausdrückliche Zustimmung entfernt oder grundlegend verändert werden.
- Vor größeren, mehrere Dateien oder Systemgrenzen betreffenden Änderungen zuerst einen kurzen Implementierungsplan mit betroffenen Bereichen, Kompatibilitätsrisiken und vorgesehenen Prüfungen vorlegen. Kleine, klar begrenzte Korrekturen können direkt umgesetzt werden.
- Änderungen möglichst klein, nachvollziehbar und im vorhandenen Stil halten. Unbeteiligte Dateien und vorhandene Nutzeränderungen nicht verändern.
- Neue Funktionen müssen passende automatische Tests erhalten. Bestehende Tests nicht löschen, abschwächen oder auslassen, um Fehler zu verdecken. Fehlerursachen beheben oder verbleibende Fehler klar berichten.
- Nach jeder Änderung knapp erklären, welche Dateien und Verhaltensweisen betroffen sind und welche Risiken oder Einschränkungen verbleiben.

## Bestehende Architektur erhalten

- `src/App.tsx` koordiniert Formularentwurf, aktiven Lernplan, Timer, Gamification und Oberfläche. Formularänderungen dürfen den aktiven Plan nicht vor der ausdrücklichen Aktualisierung verändern.
- `src/services/learningPlanGenerator.ts` ist die Service-Fassade für Lernplanerstellung; `src/services/ruleBasedLearningPlan.ts` bleibt als lokaler Fallback erhalten.
- `src/services/learningPlanApi.ts` ruft den Server auf, validiert die Antwort und verwendet bei Netzwerk-, HTTP- oder Schemafehlern den lokalen Fallback.
- `server/learningPlanApi.mjs` enthält Mock- und optionalen Groq-Provider sowie die serverseitige Antwortprüfung. `server/index.mjs` stellt die API im Vite-Entwicklungs-/Previewmodus und im lokalen Produktionsserver bereit.
- `shared/learningPlanSchema.mjs` ist das gemeinsame Laufzeitschema. Änderungen am Lernplanvertrag müssen Client, Server, Schema und Tests konsistent berücksichtigen.
- `src/services/gamification.ts` enthält Regeln für einmalige XP-/Coin-Belohnungen, Orb-Chancen, Ausrüstung, kosmetische Käufe und Gamification-Speicherung. Belohnungsregeln nicht durch Missions-Updates oder erneutes Abhaken vervielfachen.
- UI-Texte bleiben deutsch, responsiv und tastaturbedienbar. Animationen müssen `prefers-reduced-motion` respektieren.

## Nutzerdaten und Migrationen

- Bestehende Speicherformate und Nutzerdaten erhalten. Vorhandene Migrationen für ältere flache Lernpläne und den getrennten Formular-/Aktivplan-Zustand müssen weiter funktionieren.
- Die Schlüssel `mission.saved-mission.v1` und `mission.gamification.v1` sind bestehende persistente Verträge. Sie nicht umbenennen oder löschen, ohne eine getestete Migration und ausdrückliche Zustimmung vorzusehen.
- Neue gespeicherte Felder mit rückwärtskompatiblen Standardwerten laden. Fehlerhafte oder unbekannte Werte sicher validieren; gültige bestehende Werte nicht verwerfen.
- Laufende Aufgaben, Mission-IDs, abgehakte Schritte, Timer, XP, Coins, Sammlungsbesitz, ausgerüstete Orbs und gekaufte Designs dürfen durch eine Aktualisierung oder einen Reload nicht ungewollt verloren gehen.

## Sicherheit, Dienste und Abhängigkeiten

- API-Schlüssel und andere Geheimnisse niemals in React-/Frontend-Code, `VITE_`-Variablen, Antworten an den Browser, localStorage, Tests mit echten Schlüsseln oder Git speichern.
- Anbieter-Schlüssel ausschließlich serverseitig über Umgebungsvariablen lesen. `.env`-Dateien bleiben ignoriert; keine Geheimnisse in `.env.example` eintragen.
- Der Standardbetrieb bleibt `AI_PROVIDER=mock`; Tests und Entwicklungsabläufe sollen ohne kostenpflichtigen Anbieter funktionieren. Echte externe Modellaufrufe nicht für Tests aktivieren.
- Vor dem Hinzufügen neuer npm-Abhängigkeiten oder dem Aktivieren, Verwenden beziehungsweise Verursachen möglicher Kosten für einen externen Dienst die Zustimmung der Nutzerin/des Nutzers einholen. Vorher Zweck, Alternative, erwartete Kosten beziehungsweise Kostenunsicherheit und Sicherheitsfolgen verständlich erläutern.
- Eingaben und externe Modellantworten serverseitig validieren. Fehler verständlich behandeln und keine Geheimnisse, Stacktraces oder Provider-Antworten mit sensiblen Details an den Browser weitergeben.

## Tests und Build

Voraussetzung ist Node.js `>=20.19.0` und npm. Nach Änderungen aus der Projektwurzel ausführen:

```sh
npm test
npm run build
```

Beide Befehle müssen erfolgreich sein. Bei Fehlern die Ursache untersuchen und beheben, ohne Tests oder Funktionsumfang zu entfernen. Zusätzlich gezielte Tests für betroffene Verträge ergänzen, insbesondere API-Schema, Fallback, Speicher-Migration, Mission-ID, Timer und einmalige Belohnungen. Nicht ausgeführte oder fehlschlagende Prüfungen im Abschlussbericht deutlich nennen.
