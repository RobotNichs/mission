# Phase 11C – bestätigter Session-Review

## Architektur und Ablauf

App.finalizeSession bleibt der einzige Sessionabschluss-Pfad. Nur beendete Sessions mit positiver tatsächlicher Fokuszeit, sourceProject und einem vorhandenen, nicht archivierten Projekt erhalten einen Review. Das Abhaken von Planschritten startet keinen Review und beendet den Timer nicht. Schnellmissionen bleiben unverändert.

Nach Abschluss wird „Projektfortschritt übernehmen“ angeboten, auch im Fokusmodus und auf Mobile. Der Dialog beginnt mit einem lokalen Vorschlag. „Bearbeiten“ öffnet begrenzte Eingaben für Zusammenfassung, Bekannt, In Arbeit, Unsicher und eine Notiz für die nächste Session. Themen können hinzugefügt und entfernt werden. Referenzierte Meilensteine haben einzeln bestätigbare Häkchen. „Übernehmen“ ist die einzige Projektmutation; „Überspringen“ schließt den Dialog. Gültige Entwürfe und der Skip-Status bleiben in der normalen History erhalten. Überspringen entfernt das unmittelbare Angebot; ein Button in der History öffnet ihn später erneut. Während eines laufenden Timers wird das Angebot ausgeblendet. Ein übersprungener Review bleibt innerhalb der bestehenden letzten fünf History-Einträge wieder erreichbar.

Der Dialog nutzt Portal, vorhandene Modalgestaltung, Fokusfalle, Escape, inerten Hintergrund und Scrollschutz. Übernehmen ist bei fehlender Web-Lock-Schreibberechtigung oder laufendem Timer gesperrt. Bestehende Navigation, Timer, Pomodoro und Rewards werden nicht ersetzt.

## Additives Projektmodell

learningState ist optional und versioniert (Version 1). Alte 11A/11B-Projekte erhalten keine verpflichtenden neuen Felder. known, inProgress und weak enthalten jeweils höchstens 30 eindeutige Themen zu maximal 120 Zeichen. recentProgress enthält höchstens zehn Belege mit stabiler id, sessionId, createdAt und summary (maximal 240 Zeichen). nextSessionNote ist auf 240 Zeichen begrenzt. Ursprüngliches Vorwissen bleibt erhalten.

Bestätigte neue Themen werden dedupliziert ergänzt. Eine explizite neue Kategorie verschiebt dasselbe Thema aus den anderen Kategorien. Widersprüchliche Kategorien im selben Review werden abgelehnt. Bei 30 vorhandenen Themen wird eine weitere Ergänzung verständlich abgelehnt, statt bisherige Angaben still zu löschen. Der Dialog bearbeitet die Ergänzungen dieser Session, keinen vollständigen Lernstands-Katalog.

Die Projektansicht zeigt den Lernstand und die letzten Rückblicke in einem standardmäßig geschlossenen Details-Bereich. Keine Prozentwerte, automatische Beherrschung oder Projektbelohnungen.

## Review-Schema und KI

shared/projectReviewSchema.mjs validiert sowohl Input als auch Vorschlag strikt und verwirft unbekannte Felder. SessionReview Version 1 speichert einen begrenzten Ausschnitt der aktuellen Planschritte sowie pending/skipped/applied und optional Entwurf/appliedAt in der History. Maximal zwölf Schritte, Titel 90, Beschreibung 200 Zeichen. Fokuszeit und Anzahl erledigter Schritte stammen aus dem bestehenden Sessionabschluss.

/api/project-review verwendet dieselben Origin-, Rate-, Parallelitäts-, Requestgrößen-, Provider- und Diagnose-Schutzmechanismen wie die vorhandenen API-Routen. Standard bleibt mock. Externe KI wird nur über den bewussten Button „KI-Vorschlag erstellen“ angefragt. Keine automatischen Retries.

KI-Input: Ziel, aktuelle referenzierte Phase, erlaubte Meilenstein-IDs, aktuelle Session-Schritte und Häkchen, tatsächliche Fokuszeit und kompakt ausgewählter bestätigter Lernstand. Maximal 12 KiB Input; bei umfangreichen Unicode-Daten werden bestätigter Kontext und Schrittbeschreibungen lokal weiter reduziert, nötigenfalls auch die Anzahl der übermittelten Schritte. Der Dialog kennzeichnet einen begrenzten Ausschnitt. keine komplette History, Statistik, anderen Projekte oder Belohnungsdaten. Output: summary und nextSessionNote je 240 Zeichen, maximal drei Themen je Kategorie zu 120 Zeichen, ausschließlich referenzierte Meilenstein-IDs und Gründe zu 160 Zeichen. Providerlimit 1.024 Output-Tokens, maximal 32 KiB Providerantwort, bestehender 20-Sekunden-Provider-Timeout und 25-Sekunden-Client-Timeout.

Prompt: Ein erledigter Schritt beweist keine Beherrschung. Ohne zusätzliche starke Nutzerevidenz darf die KI nur bereits bestätigte known-Themen wieder als known vorschlagen; neue Beherrschungsbehauptungen werden server- und clientseitig abgelehnt. Andere bearbeitete Themen sind höchstens inProgress. Schwierigkeiten brauchen Evidenz. Jede Kategorie und jeder Meilenstein-Abschluss bleibt ein vom Nutzer zu prüfender Vorschlag.

Der lokale Fallback fasst lediglich Schritte und Fokusminuten zusammen. Er behauptet keine Kenntnisse und schließt keine Meilensteine vor. Nutzer kann alle Angaben selbst ergänzen; Offline, Timeout, 429 und ungültige Antworten verhindern den Review nicht.

## Übernahme und Doppelschutz

Vor jeder Übernahme liest der Service History und Projekte erneut. Er prüft Sessionstatus, Projektstatus, Phase, Meilenstein-IDs, den vollständigen normalisierten Projektstand sowie den Session-Input gegen den beim Öffnen erfassten Stand. Gelöschte/archivierte Projekte und veraltete Reviews werden abgelehnt; erneutes Öffnen erfasst den aktuellen Stand.

Die Übernahme benötigt den bestehenden exklusiven App-Web-Lock. Der Projekt-Schreibvorgang speichert den Session-Beleg in recentProgress. Danach erhält derselbe History-Eintrag status applied und appliedAt. Normale Schreibfehler rollen beide Schlüssel zurück. Bei einem Prozessabbruch zwischen beiden Schreibvorgängen verhindert der Projektbeleg Wiederholung; beim Laden wird die History-Markierung aus dem Beleg rekonstruiert. localStorage bietet keine Transaktion über mehrere Schlüssel, deshalb diese Beleg-Reihenfolge.

Ein Apply braucht außerdem den noch vorhandenen History-Eintrag. Wenn ein Beleg nach zehn neueren Projekt-Reviews verdrängt wurde, ist seine Session bereits aus der auf fünf Sessions begrenzten History verschwunden. Alte Tickets sind damit nicht wieder anwendbar. Reload und ein zweiter Tab lesen die Belege und den Status frisch. Es gibt keinen zweiten Reward-Pfad: nur Projekt- und Missionsspeicher werden geschrieben, weder Gamification noch Statistik.

Nur ausdrücklich bestätigte mark-completed-Vorschläge verändern milestone.status. Eine Phase wird weiterhin aus ihren Meilensteinen abgeleitet, der Projektstatus wird nicht automatisch geändert.

## Folge-Mission und Token-Kompression

Der bestehende Phase-11B-Kontext bleibt hart auf 6 KiB UTF-8 begrenzt. Er enthält ursprüngliches Vorwissen, eine aktuelle Phase, maximal drei offene relevante Meilensteine, höchstens fünf known/inProgress/weak-Themen und höchstens drei kurze recentProgress-Zusammenfassungen sowie die nächste Notiz. Themen werden lokal anhand des Phasen-/Meilensteintexts konservativ ausgewählt; Rückblicke anhand ihrer Zeit. Bei Platzmangel werden optionale Beschreibungen, Rückblicke und Themen weiter reduziert. Der Grenzwert wird nicht erhöht.

Der Tagesmissionsprompt berücksichtigt bestätigte bekannte Themen und vermeidet erneutes grundlegendes Lehren. In Arbeit und Unsicher lenken den nächsten offenen Anwendungsschritt. Open-ended bleibt rollierend ohne künstlichen Endpunkt. Keine vollständige Session-History wird übertragen.

## Backup und Kompatibilität

Backup bleibt Version 1: Die vorhandenen Projekt- und Missionsdaten werden nur um optionale, strikt validierte Felder ergänzt. Alte Backups ohne learningState oder projectReview bleiben gültig. Neue Backups erhalten learningState, Review-Entwurf, appliedAt und sourceProject. Import hat keinen Reward-Pfad und übernommene Reviews bleiben gesperrt. Ein Backup-Restore setzt den lokalen Datenstand wie bisher vollständig zurück; es ist keine Zusammenführung verschiedener Gerätehistorien.

## Tests und Grenzen

Automatische Tests decken App-Abschluss, normalen Missionabschluss, Bearbeiten/Bestätigung/Skip, Reload, gelöschte oder archivierte Projekte, geänderte Phasen und Meilensteine, Web-Lock-/Doppel-Apply-Schutz, Providervertrag und Mock/Fallback/Offline/Timeout/429/Schemafehler, Listenlimits, 6-KiB-Folgekontext, Backup-Kompatibilität, stabile sourceProject-IDs, Mobile sowie unveränderte Rewards ab. Die bestehende Regressionstest-Suite bleibt erhalten.

Bewusste Grenzen: Nur bestehende History-Sessions mit tatsächlicher Fokuszeit; keine nachträglichen Reviews für vor 11C ohne Schritt-Snapshot abgeschlossene Sessions. Entwürfe werden erst bei gültiger Struktur gespeichert; unvollständige Texte bleiben während der Eingabe im Dialog. Ein bearbeiteter Plan mit mehr als zwölf Schritten wird für den Review auf zwölf Schritte begrenzt. KI wird auf Nutzerwunsch angefordert, Ergebnisse sind keine fachlich geprüften Beherrschungsnachweise. Kein vollständiger Lernstands-Editor, keine automatische Skill-Mastery, Streaks, Prozente, Cloud oder neuen Rewards.

## Ausgeführte Prüfungen

- npm test: 1.032 Tests in 66 Dateien erfolgreich, einschließlich 57 neuer Tests.
- npm run build: TypeScript und Vite-Produktionsbuild erfolgreich.
- git diff --check: erfolgreich.

Ein zwischenzeitlicher Gesamtlauf traf den bestehenden zeitabhängigen Lazy-Load-Timeout in App.displayLevel.test.tsx. Isolierte Prüfung und anschließender vollständiger Lauf bestanden ohne Änderungen an diesem Test. Keine neuen Abhängigkeiten, echten Groq-Anfragen oder Git-Commits.
