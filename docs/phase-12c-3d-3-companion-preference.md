# Phase 12C.3D.3: Companion Preference, Backup & Data Safety

## Vertrag und Default

`mission.companion-preference.v1` enthält ausschließlich `{ "version": 1, "skinId": "milo" }`. Gültige IDs stammen über den bestehenden Visual Resolver aus der zentralen Skin-Konfiguration. Keine Besitz-, Fortschritts- oder Lerninformationen. Fehlende, beschädigte oder nicht lesbare Daten ergeben die technische Luna-Darstellung, ohne einen Key zu schreiben, zu reparieren oder zu löschen. Explizites Luna bleibt durch den vorhandenen gültigen Key von fehlender Auswahl unterscheidbar.

## Service-API

`src/services/companionPreference.ts` exportiert:

- `validateCompanionPreference(value)` und `parseCompanionPreference(raw)`: gültiges neues Präferenzobjekt oder `null`; Version, beide erforderlichen Felder und Feld-Allowlist werden strikt geprüft.
- `readCompanionPreference(storage?)`: `valid` mit Präferenz oder `missing`, `invalid`, `storage-error`.
- `resolveCompanionPreference(readResult)`: typisierte Companion-Darstellung, Luna als technischer Default.
- `saveCompanionPreference(skinId, storage?)`: expliziter Aufruf; Status `saved`, `invalid` oder `storage-error`.
- `deleteCompanionPreference(storage?)`: expliziter Aufruf; Status `deleted` oder `storage-error`.

Storage ist injizierbar. Auch der Zugriff auf die globale LocalStorage-Eigenschaft liegt innerhalb der Fehlerbehandlung. Fehler werden nicht mit Payloads geloggt. Aufrufer müssen Statuswerte auswerten; `storage-error` bedeutet niemals Erfolg. Explizite gültige Auswahl darf beschädigte Präferenz ersetzen; bloßes Laden tut dies nicht. Kein Modulimport führt Storage-Operationen aus.

## Writer und Integration

Speichern/Löschen erwerben keinen eigenen Lock. Der spätere produktive Aufrufer muss die vorhandene `MISSION_WRITER_LOCK`-Berechtigung besitzen, bei Writer-Wechsel neu lesen und Fehler anzeigen. In dieser Phase existiert kein produktiver Aufrufer dieser Auswahlfunktionen, keine automatische Persistenz und keine Rendering-Integration. Backup/Restore/Datenlöschung verwenden weiterhin den vorhandenen bestätigten UI-Pfad mit Writer-Berechtigung und angehaltenem Timer.

Gamification-Key, Payload-Version 2, Orb-Auswahl, sämtliche Besitzrechte, Journale und Coins bleiben unverändert. Der neue Key erweitert keine Besitzliste. Die künftige Luna-Standarddarstellung ändert in dieser Phase noch keine sichtbare produktive Oberfläche.

## Backup-Versionierung und Restore

Neue Exporte sind immer `mission-backup` Version **2**, auch ohne gespeicherte Präferenz. Fehlender Key bleibt fehlend, kein künstlicher Luna-Eintrag. Der bisherige 2-MiB-Rahmen und alle vorhandenen Validierungen gelten weiter. Version **1** bleibt lesbar, akzeptiert aber nur die bisherigen sieben Keys; eine Präferenz in V1 wird abgelehnt. V2 erlaubt zusätzlich den strikt validierten Präferenz-Key. Unbekannte Versionen, Felder und IDs werden weiterhin abgelehnt. Ungültige gespeicherte Präferenz verhindert den Export, statt still daraus einen gültigen Teilbackup zu machen.

Bestätigtes vollständiges Ersetzen entfernt jeden erlaubten Key, der im Backup fehlt. Deshalb löschen V1- und V2-Backups ohne Präferenz eine zuvor vorhandene Auswahl; anschließend gilt Luna technisch als Default. V2 mit gültiger Präferenz übernimmt genau diese. Bestehende Gamification-Daten werden nach demselben strikten Vertrag wiederhergestellt, nicht neu berechnet oder belohnt.

Die Snapshot-/Rollback-Allowlist umfasst nun acht Keys. Bei abgefangenen Schreibfehlern versucht der bestehende Restore alle acht Originalwerte zurückzuschreiben. Auch ein Rückschreibfehler bleibt ausdrücklich als unvollständige Wiederherstellung erkennbar. LocalStorage bietet keine Mehrschlüssel-Transaktion: Browserabbruch, Quota oder dauerhafte Storage-Sperre können Recovery verhindern. Externes Backup behalten; keine automatische vollständige Rücksetzung auf einen alten Spielstand.

Bestätigtes „Lokale Daten löschen“ erfasst denselben neuen Key. Fremde Keys und Service-Worker-Cache bleiben unangetastet. Keine globale Clear-Operation.

## Alte PWA-Builds und offene Punkte

Alte Builds lesen ihren unveränderten Gamification-Vertrag weiter und ignorieren den separaten Präferenz-Key. Sie lehnen neue V2-Backups ab. Ein alter Build kann beim eigenen V1-Restore oder Löschen den unbekannten neuen Key allerdings nicht entfernen. Erst dieser neue Stand garantiert dessen Einbeziehung. Vor Restore andere Mission-Tabs schließen; keine Änderung an Service Worker oder Updates und keine behauptete Versionsbarriere durch den Writer-Lock.

Offen für die spätere UI-Phase: Auswahlangebot, Zeitpunkt der produktiven Umstellung, Collection-/Legacy-Darstellung, Wechselregeln, Tab-Abgleich der Präferenz und Anzeige von Storage-Fehlern. Keine Orb-zu-Companion-Zuordnung, Migration, Onboarding- oder Motion-Änderung.

## Prüfungen

Gezielte Tests prüfen Default ohne Writes, explizites Luna, Milo/Nova, strikte Payloads, defektes JSON, Zugriff-/Schreib-/Löschfehler, Import ohne Seiteneffekt, V1/V2-Trennung, fehlende Auswahl, Restore, Rollback einschließlich Präferenz, unveränderte Gamification und gezielte Datenlöschung. Der Produktionsbundle-Test erlaubt jetzt die für Validierung notwendige zentrale Farbkonfiguration, prüft aber weiterhin den Ausschluss von Renderer, Preview und Motion-Code. Die vollständige Suite sichert bestehende Orb-, Prestige-, Crate-, Backup- und UI-Verträge ab. Konkrete Laufergebnisse stehen im Abschlussbericht.

Ergebnisse: 35 gezielte Tests bestanden. Unter Standardparallelität scheiterte der bestehende erste Dev-Level-UI-Test einmal am 5-Sekunden-Timeout und einmal beim Warten auf das nachgeladene Dev-Panel. Isoliert bestanden alle fünf Tests dieser Datei. Die vollständige unveränderte Suite mit `npm test -- --maxWorkers=2` bestand mit 1.170 Tests in 76 Dateien. TypeScript-/Produktionsbuild erfolgreich; keine Timeouts oder Assertions zur Umgehung des Problems verändert.
