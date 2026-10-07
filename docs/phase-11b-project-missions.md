# Phase 11B – Tagesmissionen aus lokalen Projekten

## Architektur und UI-Flow

Aktives Projekt in der Bibliothek öffnen → Heutige Mission erstellen → heutige Zeit (5–60 Minuten in Fünferschritten), Energie, Lernblocker und optional bestehende Fokusstrategie wählen → normalen Lernplan erzeugen. Auf Mobile wird anschließend der bestehende Planbereich geöffnet, ohne neue Navigation. Pausierte, abgeschlossene und archivierte Projekte bieten die Aktion nicht an; Reaktivierung erfolgt über den bestehenden Projekteditor.

Der Aufruf läuft über projectMissionRequest und den vorhandenen Service learningPlanGenerator / learningPlanApi mit POST /api/learning-plan. Das normale Step-Schema, der Planeditor, Fokusmodus, Timer, Pomodoro, History, Statistik und Gamification bleiben maßgeblich. Eine Tagesmission erhält eine neue Mission-ID und neue Step-IDs; das verhindert, dass derselbe Projektzieltext alte Session-Häkchen oder Belohnungsschlüssel übernimmt. Ein bestätigter Wechsel beendet eine vorhandene aktive oder pausierte Session über die normale History-Logik und erhält bereits gemessene Fokuszeit. Der neue Timer startet pausiert. Schnellmissions-Updates ohne Projektbezug behalten ihren bestehenden Abgleich.

## Manuelle Meilensteine und aktuelle Phase

Meilensteine können in der Projektansicht manuell offen/erledigt markiert werden. Das optionale status-Feld akzeptiert pending/completed; fehlende Statusfelder aus Phase 11A gelten als pending. IDs und Speicher-/Roadmapversion 1 bleiben erhalten. Aktuell ist die erste Phase mit mindestens einem offenen Meilenstein. Bis zu drei offene Meilensteine dieser einen Phase werden gewählt; textuell noch nicht bekannte Inhalte stehen zuerst. Keine Prozentwerte. Sind alle Meilensteine erledigt, muss eine Etappe manuell wieder geöffnet oder die Roadmap angepasst werden. Es wird kein automatischer Folgeabschnitt erfunden.

## Kompakter Prompt-Kontext

projectMissionContext.mjs prüft und konstruiert einen versionierten, strikt begrenzten Ausschnitt: Projekt-ID, Ziel/Titel, Ausgangslage, bekannte Kenntnisse, Zeithorizont, Wochenzeit/Lerntage, bestehender Lernkontext, Roadmap-Zusammenfassung (max. 240), eine aktuelle Phase (Titel max. 90, Beschreibung max. 240), maximal drei offene Meilensteine (Titel 90/Beschreibung 200). Ausgangslage max. 300, bekanntes Vorwissen max. 400, Materialdetails entsprechend dem vorhandenen 240-Zeichen-Vertrag. Harte Gesamtgrenze: 6 KiB UTF-8 für den serialisierten Kontext.

Bei übergroßen Unicode-Freitexten werden zuerst Zusammenfassung und Beschreibungen entfernt, dann Ausgangslage/Vorwissen auf 200/300 Zeichen begrenzt, zuletzt auf einen Meilenstein reduziert. Der gespeicherte Projekttext bleibt vollständig erhalten. Das ist keine Sessionhistorien-Kompression. Die API validiert die Grenze zusätzlich und verweigert unbekannte Felder.

Keine Projekthistorie, manuellen Notizen, alten Tagesmissionen, Statistik, Coins, Orbs oder Prestige im Prompt. Die Fokusstrategie wird lokal an den erzeugten Plan angehängt; sie ist keine zusätzliche KI-Eingabe. Bestehende API-Grenzen, Diagnosen und Timeouts bleiben aktiv: 16 KiB Request, 20 Sekunden Provider, 25 Sekunden Client, kein automatischer Retry. Projektmissionen nutzen höchstens 2.048 Output-Tokens und zusätzlich maximal 64 KiB Providerantwort vor Parsing.

Der normale Systemprompt wird ausschließlich bei projectContext ergänzt: nur diese Session und exakt heutiges Zeitbudget; aktuelle Phase/Meilensteine, niedrige Energie mit kleinen klaren Schritten, hohe Energie mit anspruchsvollerer Anwendung, sichtbare Blockerberücksichtigung, vorhandene Materialien ohne Erfindungen, kein Gesamtplan, keine neue Roadmap, keine Erfolgsgarantien. Keine Rückfrage bei Projektmissionen.

## Vorwissen und open-ended

Promptregel: Bereits als bekannt angegebene Inhalte nicht erneut als primäres Lernziel planen, außer kurze Wiederholung ist zur Einordnung, Prüfungsvorbereitung oder wegen eines Blockers sinnvoll. Eine solche Wiederholung muss im Titel gekennzeichnet sein (Wiederholung/Abruf/Selbstprüfung/Einordnung) und insgesamt höchstens fünf Minuten bzw. ein Fünftel der Session belegen.

Server- und Clientprüfungen erkennen explizite Wortübereinstimmungen von Vorwissen und Schritttitel; bei unnötig erneutem Hauptlernen wird die Antwort mit einem festen Schema-Code verworfen und der lokale Fallback genutzt. Verneinte Vorwissenssätze werden von dieser Wortprüfung ausgenommen. Die Auswahl bevorzugt noch nicht bekannte Meilensteine; bei ausschließlich bekannten Meilensteinen wählt der Fallback einen nächsten kleinen Anwendungsschritt. Synonyme, komplexe Verneinungen und implizite Kenntnisse sind nicht zuverlässig maschinell prüfbar. Der Prompt berücksichtigt zusätzlich die vollständige bzw. begrenzte Ausgangslage. Alle Pläne bleiben bearbeitbare Vorschläge.

Open-ended betrachtet nur die aktuelle rollierende Etappe. Keine Endplanung und kein prozentualer Projektabschluss. Zeitfortschritt wird nicht als Projekt-Lernfortschritt ausgegeben.

## sourceProject, History und Backup

Optionaler Plan-/Session-/Historyverweis: sourceProject mit projectId, phaseId und maximal acht milestoneIds (aktuell bis zu drei). Nur technische IDs, keine kopierte Projektstruktur. Plan und aktive Session werden beim Reload mit vorhandenen Normalisierungen geladen. Manuelles Bearbeiten und Umordnen von Steps erhält die Referenz. Beim Sessionstart wird der Verweis in den normalen aktiven History-Zustand kopiert und beim Abschluss erhalten. History weiterhin maximal fünf reguläre Einträge.

Alte Missionen, History und Phase-11A-Projekte ohne neue Felder bleiben gültig. Die neuen optionalen Felder werden im bestehenden Backup v1 strikt geprüft, exportiert und importiert. Fehlende oder gelöschte Projekte machen eine bereits übernommene Mission oder historische Referenz nicht ungültig: der Plan funktioniert weiter, der kompakte Herkunftshinweis zeigt bei Bedarf Nicht mehr vorhanden. Als Vorlage gespeicherte Missionen verwenden weiterhin den bestehenden Vorlagenvertrag; daraus gestartete Vorlagen sind eigenständige Missionen ohne Projektbindung.

Vor Anfrage und erneut unmittelbar vor Übernahme wird der lokale Projektzustand geprüft. Gelöschtes/beschädigtes/inaktives Projekt, andere aktuelle Phase oder geänderte relevante Projektdaten verhindern die Übernahme; der bisherige Plan bleibt bestehen. Die API kann den lokalen Projektstatus nicht unabhängig vom Browser kennen. Offline, Timeout, 429, Netzwerk- und Schemafehler nutzen den bestehenden sicheren Diagnose-/Fallbackpfad. Keine textreichen Fehlerlogs oder automatische Retries.

## Fallback, Rewards und Grenzen

Der vorhandene lokale Lernplangenerator besitzt eine gezielte Projektverzweigung mit denselben Plan-/Step-Typen und derselben exakten Minutenverteilung. Er berücksichtigt Projektphase, nächsten relevanten Meilenstein, Zeit, Energie, Blocker, Ausgangslage/Vorwissen und Lernkontext. Auch ohne Materialien bleiben Phase, Zielrichtung und Energiehinweise sichtbar. Keine erfundenen Fachdetails.

Projektaktionen und manuelles Meilenstein-Abhaken rufen keine Belohnungs- oder Fokusbuchung auf. Nur die reguläre Mission nutzt die bestehenden Regeln für tatsächlich gemessene Fokuszeit und vorhandene Missions-/Schrittbelohnungen; Pausen bleiben unvergütet. Kein neuer Rewardtyp.

Nicht enthalten: automatische Session-Zusammenfassung, Wissensänderung, Meilensteinabschlüsse, Projekt-Streaks, neues Skill-State-Modell, alte Session-Kompression, Cloud/Accounts/Social. Keine neuen Abhängigkeiten, echte Groq-Aufrufe oder Git-Commits.

## Prüfungen

Neue Service-/Schema-, Mock-/Provider- und App-Integrationstests prüfen aktive/inaktive Projekte, 5/30/60 Minuten, Energie/Blocker, Lernkontext, aktuelle Phase und Vorwissen, kurze Wiederholung, Kontext-Bytes und Datenminimierung, sourceProject und alte Pläne, Editor/Fokusstrategie, echten Timer/Pomodoro, History/Reload/Backup, Fokus-Coins ohne Projektvergütung, Fehler-/Fallbackpfade, Löschung/Archivierung während der Anfrage und mobile Navigation. Dazu vollständige Regressionssuite, Produktionsbuild und git diff --check.
