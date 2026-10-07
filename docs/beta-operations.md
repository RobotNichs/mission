# Öffentliche Beta: Betrieb und Transparenz (Phase 10C)

## Lokale Daten und Backup

Info & Daten ist über den Dashboard-Header erreichbar. Mission hat keine Accounts, Cloud-Synchronisierung oder Analytics. Lerntexte/Antworten/Kontext gehen bei externer KI über den Server an den konfigurierten Anbieter. Hosting-Verbindungslogs liegen außerhalb der Kontrolle dieser App. Es gibt keine Zusage vollständiger Anonymität.

`mission-backup`, Version 1, enthält exportedAt und eine feste data-Allowlist: mission.saved-mission.v1, mission.gamification.v1, mission.statistics.v1, mission.templates.v1, mission.focus-environment.v1, mission.onboarding.v1. Ziele sind Teil der Statistik, Kontext Teil der Mission/Vorlagen; Prestige wird aus kumulierter Fokuszeit abgeleitet. Kein ENV, API-Key, Serverlog oder Worker-Cache wird gelesen. Backups sind unverschlüsselt und enthalten persönliche Lerntexte; privat aufbewahren. Kein unabhängiger Echtheitsnachweis: Wer seine lokale JSON-Datei verändert, kann lokale Fortschrittswerte verändern. Es gibt kein öffentliches Ranking.

Import: maximal 2 MiB, nur Version 1, vollständige Strukturprüfung vor einer Änderung, Ersetzen nach Bestätigung. Beschädigte/ältere nicht unterstützte Speicherstände werden beim Export nicht still bereinigt, sondern mit einem Fehler abgelehnt. Alte App-Speicherstände bleiben durch die bestehenden App-Migrationen nutzbar; vor Backup einmal regulär öffnen. Keine stillen Teilimporte. Bei Speicherfehler Rollback der sechs Schlüssel; auch Rollback kann bei beschädigtem/gesperrtem Browser-Speicher scheitern und meldet dies. LocalStorage besitzt keine echte Mehrschlüssel-Transaktion.

Datenaktionen nur bei angehaltenem Timer, keiner Planerzeugung/Rückfrage und bestehender exklusiver App-Web-Lock. Vor Ersetzen/Löschen andere Mission-Tabs schließen. Import lädt neu; bestehendes Reload-Verhalten stellt Timer angehalten her und rechnet keine Offline-Zeit an. Löschen entfernt nur die feste Mission-Allowlist, nicht Browser-Globaldaten und nicht den Service Worker. Backups selbst erzeugen keine Vergütung.

Der Feedback-Link enthält ausschließlich den neutralen Betreff Mission Beta Feedback. Gewünschter temporärer Mock-Empfänger vorname@nachname@gmail.com ist wegen zweier @-Zeichen ungültig und muss vor Einladung durch einen echten Kanal ersetzt werden. Kein automatischer Versand, kein Tracking und keine Lerntexte in der URL.

## Technische Beobachtung und Kosten

Vorhandenes Event learning_plan_failure: diagnosisId, category, durationMs, technischer Providerstatus, validationCodes/validationErrors mit schemaCode, Schrittindex/Feld. Qualitätsdiagnosen bestehen aus festen technischen Codes. Keine Lernziele, Material-/Blockadefreitexte, Request-Payloads, vollständigen Modellantworten, Keys oder bewusst gespeicherten IP-Logs. Die Rate-Limit-Tabelle hält Socketadressen kurzzeitig im Arbeitsspeicher, ohne sie zu protokollieren. Hosting-Logs separat prüfen. Keine Analytics, keine neue Monitoring-Plattform. Erfolgs-/Nutzertracking wurde nicht ergänzt.

Aktuelle Grenzen: 10 AI-Anfragen/Socketadresse/Minute, 30/Prozess/Minute, maximal vier gleichzeitig; 16 KiB Body; Outputlimit 2048 Tokens, Provider-Timeout 20 Sekunden, Client-Timeout 25 Sekunden. Keine Retries. 429 nennt optional die sichere Retry-After-Wartezeit, danach lokaler Ersatzplan; offline wird gesondert erklärt. Keine automatische erneute Anfrage. Fehlertexte und Diagnose-ID enthalten keine Provider-Rohtexte.

Limits sind keine harte Tageskostenobergrenze. Missbrauch kann gemeinsame Kontingente aufbrauchen und bei Groq Kosten verursachen. Neustarts verlieren In-Memory-Limits, mehrere Instanzen vervielfachen sie. Render-Proxies können Nutzer in einem Bucket zusammenfassen. Free-Service kann schlafen und beim Start verzögern; Browserdaten bleiben lokal. Vor größerer Beta Anbieterbudget/Alarme, Hosting-Grenzen und Trusted-Proxy-/Edge-Schutz separat prüfen. Nur Mock ist ohne Modellkosten. Siehe deployment.md für Deployment/PWA und bekannte Grenzen. Keine echte Render-/Groq-Abnahme wurde in dieser Phase ausgeführt.

## Vor Einladung erster Tester

- Öffentlicher Link, HTTPS und /api/health funktionieren; keine Secrets oder internen Pfade.
- PWA-Manifest, Worker, Installation und Offline-Shell prüfen.
- Groq erst ausdrücklich autorisiert und mit rotiertem serverseitigem Secret testen; danach Fallback und 429/Retry-After prüfen.
- Privates Backup herunterladen, erfolgreich importieren und pausierten Timer ohne neue Coins/Fokuszeit prüfen.
- Beschädigtes Backup muss unverändert ablehnen; Löschung nur Mission-Daten, fremder Testschlüssel bleibt erhalten.
- Mobile Navigation, Fokusmodus, Pomodoro, Bibliothek, Statistik und Tour prüfen.
- Client-Artefakte secretfrei; technische Logs enthalten keine Lerninhalte. Hosting-Logs separat prüfen.
- Echten Feedback-Empfänger konfigurieren; Mock-Adresse ist nicht beta-tauglich.
- Datenschutztexte gegen tatsächliche AI-/Hosting-Konfiguration prüfen; für öffentliche rechtliche Anforderungen Betreiberangaben/Datenschutzerklärung separat fachkundig klären, diese technischen Hinweise ersetzen sie nicht.
