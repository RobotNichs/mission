# Phase 11A – lokale Langzeitprojekte

## Architektur und Abgrenzung

Langzeitprojekte ergänzen Schnellmissionen. Der Projektbereich liegt in der Bibliothek; mobile Navigation und Router bleiben unverändert. App.tsx bindet die Komponente ein und reicht die bestehende Schreibberechtigung weiter. Während einer Roadmap-Anfrage bleibt das Ersetzen/Löschen über Info & Daten gesperrt. Der bestehende aktive Plan, Formularentwurf, Timer/Pomodoro, Fokusmodus, Historie, Vorlagen, Statistik, Belohnungen und Prestige werden durch Projektaktionen nicht verändert.

## Modell und Schema

Gemeinsame Laufzeitvalidatoren und TypeScript-Verträge: shared/longTermProjectSchema.mjs / .d.mts. Projektversion 1 mit stabiler lokal generierter ID, Titel (90), Ziel (280), createdAt/updatedAt, Status active/paused/completed/archived, Ausgangslage beginner/basic/advanced/custom, eigener Beschreibung (300), optionalem Vorwissen (400), strukturiertem Zeitraum, Wochenminuten (30–4.200), optionalen Lerntagen (null oder 1–7), bestehendem Lernkontext und manuellen Notizen (2.000). Enddatum: reales Kalenderdatum, nicht vor Erstellung und höchstens zehn Jahre in der Zukunft. Ein abgelaufenes Datum bleibt beim Reload gültig; neu gewählte Enddaten werden gegen heute geprüft.

Roadmapversion 1: Zusammenfassung (400), 1–8 Phasen, je 1–8 Meilensteine. Phasen: eindeutige ID, Titel (90), Beschreibung (300), lückenlose Reihenfolge ab 0, optionaler geschätzter Zeitraum in Tagen/Wochen. Meilensteine: eindeutige ID, Titel (90), optionale Beschreibung (200), Reihenfolge. Fremde Felder, Tageslisten, doppelte IDs, falsche Versionen, HTML und Steuerzeichen werden verworfen. Provider-IDs werden im Client durch lokale IDs ersetzt. Manuelle Änderungen und Umordnung erhalten bestehende IDs.

## KI und Fallback

POST /api/project-roadmap nutzt dieselbe Middleware mit 16-KiB-Eingabelimit, Rate-/Parallelitätsbegrenzung, Herkunftsprüfung, Abbruch und sicheren Diagnosen. Der gemeinsame Provider-Adapter behält das Verhalten der Schnellmission; die neue Roadmap-Konfiguration nutzt 3.072 Output-Tokens, maximal 64 KiB Provider-Antwort, 20 Sekunden Provider- und 25 Sekunden Client-Timeout. Keine Retries.

Prompt erhält ausschließlich Projektziel, Titel, Ausgangslage, Zeitraum, Wochenzeit, Lerntage und den bestehenden Lernkontext; keine manuellen Notizen oder alten Provider-Antworten. Eingaben sind Daten, keine Anweisungen. Keine Tageslisten, erfundenen Materialien, Erfolgsgarantien oder vollständigen Lehrplantexte. Lange Zeiträume werden gröber geplant; offene Projekte erhalten rollierende Etappen ohne künstliches Endziel. Neben Schema-Prüfung wird die vorhandene konservative Materialprüfung wiederverwendet. Das ersetzt keine fachliche Inhaltsprüfung.

Mock und lokaler Fallback organisieren Orientierung, Grundlagen, Übung, Anwendung und Reflexion; bei zehn Tagen drei kompaktere Etappen. Ziel, Vorwissen, Zeithorizont und Wochenzeit fließen ein, ohne unbekannte Fachinhalte zu erfinden. Bei Netzwerk-, HTTP-, JSON-, Schema- oder Timeoutfehlern wird lokal ein Vorschlag erzeugt. Keine neuen Abhängigkeiten und keine echten Groq-Anfragen in Tests.

## Speicherung und Backup

Neuer, unabhängiger Schlüssel mission.projects.v1: {version:1, projects:[...]}, maximal 50 Projekte einschließlich archivierter Projekte. Einzelne beschädigte Einträge und doppelte Projekt-IDs werden beim Laden isoliert und als Hinweis gezählt. Ein beschädigter oder unbekannter Speicherumschlag wird nicht automatisch überschrieben. Speicherfehler lassen den Entwurf offen. Gültige Projekte werden beim Speichern erneut geprüft.

Backup bleibt Version 1: Der Datenumschlag lässt optionale Schlüssel zu; die erlaubte Schlüsselliste wurde um mission.projects.v1 erweitert. Export und Import prüfen alle Projekte strikt, ohne beschädigte Einträge stillschweigend zu übernehmen. Alte Backups ohne Projekte bleiben lesbar. Wie bei den übrigen Daten ersetzt Import den gesamten lokalen Zustand: fehlt der Projektschlüssel, entstehen keine Projekte. Ersetzen/Löschen und Rollback erfassen auch Projekte. Ein alter App-Stand mit alter Schlüsselliste kann neue Backups mit Projekten nicht lesen. Maximalgröße bleibt 2 MiB; besonders große Gesamtdaten können diese Grenze erreichen. Es werden keine Belohnungen oder Fokusbuchungen ausgeführt.

## Oberfläche und Grenzen

Drei Schritte: Ziel, Ausgangslage/optionaler Lernkontext, Zeitplanung. Projektansicht zeigt Stammdaten, Kontext, Roadmap, Phasen und Meilensteine. Bearbeitung erfolgt lokal, mit ausklappbarem Roadmap-Editor: Titel/Beschreibungen, Status, Notizen, Meilensteine hinzufügen/löschen sowie Phasen/Meilensteine umordnen. Jede Phase behält mindestens einen Meilenstein. Keine Prozentanzeigen, Projekt-Streaks, Session-Rückschreibung, Cloud oder täglichen Missionen. Phasen hinzufügen/löschen und separate Projektlöschung gehören nicht zu dieser Phase. Bestehende Info-&-Daten-Funktion kann den gesamten lokalen Zustand löschen.

## Prüfungen

Neue Modell-, Storage-, Backup-, Provider- und UI-Tests decken Vorwissens-/Zeitvarianten, Grenzen, Fallback, beschädigte Antworten, stabile Bearbeitungs-IDs, Status, Reload, beschädigten Storage, 50-Projekt-Limit, alte Backups, fehlende Belohnungen, textfreie Diagnosen und mobile Bibliotheksnavigation ab. Dazu vollständige bestehende Regressionssuite, TypeScript/Produktionsbuild und git diff --check.
