# Phase 12C.3D.1: Orb-to-Companion Migration Audit

Analyse des Repository-Stands am 16.10.2026. **Keine Migration ausgeführt, keine produktiven Dateien geändert und keine Browser-Spielstände ausgelesen.** Die folgenden Ist-Aussagen beruhen auf Quellcode und vorhandenen Tests, nicht auf einer Untersuchung des öffentlichen Deployments oder realer Nutzerdaten. Vorschläge und offene Produktentscheidungen sind ausdrücklich getrennt.

## 1. Ist-Architektur und tatsächliche Datenflüsse

### 1.1 Zuständigkeiten

| Bereich | Tatsächliche Quelle / Funktionen |
| --- | --- |
| Fortschrittsvertrag | [`GamificationState`, `initialGamificationState`](../src/types/gamification.ts) |
| Normale Orbs und Standard | [`orbCollection`, `defaultOrb`, `rarityLabels`](../src/services/orbCatalog.ts) |
| Belohnungen, Kauf und Laden | [`addFocusTime`, `rollOrb`, `purchaseOrbCrate`, `equipOrb`, `loadGamificationState`](../src/services/gamification.ts) |
| Prestige-Rang | [`getPrestige`, `prestigeMilestones`](../src/services/prestige.ts) |
| Prestige-Berechtigung und Ausrüstung | [`prestigeOrbs`, `isPrestigeOrbAvailable`, `canEquipOrb`, `getEquippedOrb`](../src/services/prestigeOrbs.ts) |
| Schreiben, Tab-Abgleich, Timer | [`App`: `commitGamification`, `settleTimer`, `handleCratePurchase`, Hydrierung](../src/App.tsx) |
| Exklusive Schreibberechtigung | [`acquireMissionWriter`, `MISSION_WRITER_LOCK`, `advanceFocusSession`](../src/services/focusTimer.ts) |
| Datenexport und Ersetzen | [`BACKUP_KEYS`, `parseBackup`, `exportBackup`, `replaceLocalData`](../src/services/localBackup.ts), [Bestätigung in `BetaInfo`](../src/components/BetaInfo.tsx) |
| Companion | [`MissionCompanion`](../src/components/MissionCompanion.tsx), [`companionSkins`](../src/components/companionSkins.ts) |

Die Beschreibung in `AGENTS.md` erwähnt noch XP-/Orb-Belohnungen. Für den tatsächlichen Ist-Stand sind die aktuellen Funktionen maßgeblich: Schritte und Missionsabschlüsse vergeben keine Coins oder Orbs. `legacyXp` ist ein inaktiver Archivwert.

### 1.2 Fokuszeit und Coins

1. `App.settleTimer()` ermittelt tatsächlich abgelaufene Zeit über den monotonen Timer aus `focusTimer.ts`.
2. Bei Fokusblöcken liefert `advanceFocusBlocks` den anrechenbaren Fokusanteil; Pause ergibt keine Vergütung.
3. `addFocusTime` erhöht `totalFocusMilliseconds` und berechnet Coins als Differenz der vollständigen Minuten vor/nach der Buchung. Fragmente bleiben kumuliert. Käufe vermindern Coins, nicht Fokuszeit.
4. `settleTimer` schreibt zuerst die vorbereitete Statistikbuchung, dann Gamification und anschließend die abgeglichene Statistik. [`prepareFocusBooking` / `reconcileStatistics`](../src/services/learningStatistics.ts) verwenden `pending` und `accountedThrough` zur Wiederaufnahme. Der Missions-/Timer-Snapshot wird ebenfalls gespeichert.
5. Level werden nicht gespeichert, sondern über `floor(sqrt(Fokusminuten / 30)) + 1` abgeleitet. Prestige wird separat aus denselben kumulativen Millisekunden abgeleitet.

**Invariante für jede Migration:** Diese Buchungskette nicht aufrufen oder nachspielen. `coins`, `totalFocusMilliseconds`, Statistikjournal, Mission-/Session-IDs, Timerstände und Historie müssen durch reine Kosmetikaktionen unverändert bleiben.

### 1.3 Crate-Kauf

`OrbCrateShop` erzeugt erst eine temporäre `crypto.randomUUID()` als Kauf-ID. Die Bestätigung ruft `onPurchase` auf; ein `consumed`-Ref verhindert denselben Bestätigungsvorgang erneut. `App.handleCratePurchase` prüft Writer-Besitz und ruft `purchaseOrbCrate(game.current, id, Math.random(), Math.random())` mit dem aktuellen Ref auf. `commitGamification` persistiert den vollständigen neuen Zustand **vor** der Ergebnisanimation.

`purchaseOrbCrate` prüft Kauf-ID, bereits verarbeitete ID, Guthaben und Zufallswerte. Kosten: **30 Coins**, genau ein Orb. Seltenheit: Common 60 %, Rare 25 %, Epic 12 %, Legendary 3 %. Innerhalb der gewählten Seltenheit wählt ein zweiter Zufallswert gleichmäßig aus deren Katalogeinträgen. Prestige- und Standard-Orb sind nicht im Pool.

Ein Duplikat kostet ebenfalls 30 Coins, ergänzt keinen Besitz und gibt keinen Bonus. Auch dessen Kauf-ID wird gespeichert. Die Ergebnisanzeige ist temporärer React-State, kein persistenter Kaufbeleg mit Orb-Zuordnung. Ein Reload nach erfolgreichem Schreiben kann die Reveal-Ansicht verlieren, nicht aber den bereits gespeicherten Kauf. Zwei unterschiedliche bewusst bestätigte Kauf-IDs sind zwei legitime Käufe; die Idempotenzsperre gilt pro ID, nicht pauschal für zeitnahe Käufe.

### 1.4 Ausrüstung und Darstellung

`equipOrb` erlaubt ausschließlich `null`, einen besessenen normalen Katalog-Orb oder einen durch echte Fokuszeit berechtigten Prestige-Orb. `getEquippedOrb` prüft erneut und liefert bei ungültiger Auswahl den Standard. **`null` ist die gespeicherte Standardauswahl; `orb-default` ist die Render-ID, kein regulärer Besitz-/Ausrüstungswert.**

`OrbCollectionDialog` zeigt Standard, alle 40 normalen Orbs einschließlich gesperrter Einträge und einen getrennten Prestige-Bereich. Standardauswahl ruft `onEquipOrb(null)` auf. In `App` wird Ausrüstung unter derselben Writer-Sperre persistiert. Die Sammlung enthält keine eigene Belohnungslogik.

`OrbVisual` rendert `OrbDefinition.visual` als CSS-/SVG-Skin; es lädt oder verändert keinen Besitz. Der ausgerüstete Orb fließt über `getEquippedOrb` in Mission Core, Fokusmodus und mobile Navigation.

## 2. Speicher-, Besitz- und Versionierungsmodell

### 2.1 Gamification-Vertrag

Key: **`mission.gamification.v1`**, inneres Datenformat: **`version: 2`**. Key-Suffix und Payload-Version sind verschiedene Verträge.

| Feld | Bedeutung und Migrationsbedarf |
| --- | --- |
| `version` | Aktuell 2; bei bestehendem Key nicht ungeprüft neu interpretieren |
| `legacyXp` | Inaktives XP-Archiv, erhalten und nicht in neue Belohnungen umrechnen |
| `totalFocusMilliseconds` | Autoritative kumulative Fokuszeit; persistent präziser als volle Minuten |
| `coins` | Aktuelles Guthaben nach Käufen; nicht aus Fokuszeit neu berechnen |
| `ownedOrbIds` | Eindeutige normale Orb-Besitz-IDs; kein Erwerbsdatum, keine Anzahl von Duplikaten |
| `equippedOrbId` | Normale/Prestige-ID oder `null` für Standard |
| `completedCratePurchaseIds` | Kauf-Idempotenzjournal; keine Rückschlüsse auf genaue Drops oder Kaufzeitpunkte möglich |
| `claimedStepRewardKeys` | Historische Schritt-/Slot-Zuordnung; für Planabgleich erhalten, nicht neu belohnen |
| `claimedMissionIds` | Historische Abschlusskennungen; nicht löschen oder erneut vergüten |
| `ownedCosmeticIds` | Frühere Käufe von Hintergrund-/Core-Effekten; weiter erhalten |
| `selectedBackgroundId`, `selectedCoreEffectId` | Auswahl früherer Kosmetik, getrennt von Orb-Ausrüstung |

Initial: 0 Coins/Fokuszeit/Archiv-XP, leere Listen, `equippedOrbId: null`, Hintergrund `deep-space`, Effekt `core-soft`.

Historische Kosmetik-IDs bleiben im Code bekannt: `background-violet-dusk`, `background-cyan-depth`, `core-effect-eclipse`, `core-effect-prism`. Der frühere [`CoinShop`](../src/components/CoinShop.tsx) und Kauf-/Ausrüstungsfunktionen existieren weiter; der aktuelle Dashboard-Pfad verwendet `OrbCrateShop`. Fehlende Sichtbarkeit eines alten Shops bedeutet nicht, dass seine gespeicherten Rechte entfernt werden dürfen.

### 2.2 Vollständiger Orb-ID-Bestand

Quelle: `orbCatalog.ts`; vier Seltenheiten, **40 normale Orbs**, zusätzlich Standard und **5 Prestige-Orbs**, insgesamt **46 Render-Definitionen**.

| Common, 20 | Anzeigename |
| --- | --- |
| `orb-common` | Morgenlicht |
| `orb-common-coral` | Koralle |
| `orb-common-mint` | Minze |
| `orb-common-sky` | Himmelblau |
| `orb-common-lilac` | Flieder |
| `orb-common-rose` | Rosenquarz |
| `orb-common-lime` | Limette |
| `orb-common-amber` | Bernstein |
| `orb-common-teal` | Lagune |
| `orb-common-indigo` | Indigo |
| `orb-common-peach` | Pfirsich |
| `orb-common-ruby` | Rubinrot |
| `orb-common-forest` | Waldgrün |
| `orb-common-ice` | Eisblau |
| `orb-common-plum` | Pflaume |
| `orb-common-sand` | Dünensand |
| `orb-common-silver` | Silberlicht |
| `orb-common-copper` | Kupfer |
| `orb-common-ocean` | Ozean |
| `orb-common-smoke` | Rauchglas |

| Rare, 10 | Anzeigename |
| --- | --- |
| `orb-rare` | Nordlicht |
| `orb-rare-opal` | Opal |
| `orb-rare-mercury` | Quecksilber |
| `orb-rare-prism` | Prismenglas |
| `orb-rare-malachite` | Malachit |
| `orb-rare-sunset` | Abendsonne |
| `orb-rare-pearl` | Mondperle |
| `orb-rare-obsidian` | Obsidian |
| `orb-rare-aquamarine` | Aquamarin |
| `orb-rare-bismuth` | Wismut |

| Epic, 7 | Anzeigename |
| --- | --- |
| `orb-epic` | Nebelrose |
| `orb-epic-eclipse` | Eklipse |
| `orb-epic-tidal` | Gezeiten |
| `orb-epic-hex` | Kristallmatrix |
| `orb-epic-comet` | Kometenschweif |
| `orb-epic-solar` | Sonnenkranz |
| `orb-epic-iris` | Irisblüte |

| Legendary, 3 | Anzeigename |
| --- | --- |
| `orb-legendary` | Sternenstaub |
| `orb-legendary-singularity` | Singularität |
| `orb-legendary-celestial` | Himmelskrone |

Separater Standard: **`orb-default`**, Common, immer verfügbar, Darstellung über `defaultOrb` und gespeicherte Auswahl `null`.

| Prestige-ID | Name | Stufe / kumulative Stunden | Stabile Stufen-ID / Reward-Slot |
| --- | --- | --- | --- |
| `orb-prestige-astral` | Astral | I / 25 | `prestige-i` / `prestige-i-cosmetic` |
| `orb-prestige-orbit` | Orbit | II / 75 | `prestige-ii` / `prestige-ii-cosmetic` |
| `orb-prestige-pulsar` | Pulsar | III / 200 | `prestige-iii` / `prestige-iii-cosmetic` |
| `orb-prestige-zenith` | Zenith | IV / 500 | `prestige-iv` / `prestige-iv-cosmetic` |
| `orb-prestige-singularity-prime` | Singularity Prime | V / 1.000 | `prestige-v` / `prestige-v-cosmetic` |

Alle fünf Prestige-Definitionen tragen technisch `rarity: 'legendary'`, gehören aber **nicht** zum normalen Legendary-Droppool. Die Seltenheit allein beschreibt daher keine Erwerbsquelle.

Prestige-Rechte werden bei jedem Aufruf aus Fokuszeit abgeleitet, nicht als Besitzliste gespeichert. Höhere Stufen erlauben alle niedrigeren. Ein Eintrag in `ownedOrbIds` kann Prestige nicht vortäuschen. Sinkt die gespeicherte Fokuszeit durch Restore auf einen älteren Stand, sinkt auch die daraus abgeleitete Berechtigung; eine dauerhafte unabhängige Freischaltgarantie existiert nicht.

Produktiv kommen normale neue Orbs aus Crates. Ausnahmen sind vorhandener historischer Besitz, bestätigter Backup-Restore und der ausdrücklich lokale Dev-Modus: [`applyDebugAction`](../src/services/gamificationDebug.ts) kann 300 Test-Coins oder normale Test-Orbs persistent hinzufügen. Diese Herkunft wird nicht separat markiert. Das lokale Modell ist keine fälschungssichere oder serververifizierte Ökonomie; eine Migration kann daraus keine nachträgliche Herkunftssicherheit ableiten.

### 2.3 Tatsächliches Lade-/Migrationsverhalten

`loadGamificationState` liest JSON, entfernt doppelte String-Einträge, filtert normale Orb-IDs gegen `orbCollection` und Kosmetik gegen `cosmeticShopItems`, normalisiert Zahlen und Auswahl. Fehlende Listen werden leer; ungültige Auswahl wird `null`. XP wird über `legacyXp ?? xp` archiviert, Fokuszeit nicht aus XP erfunden.

Wichtig: Der Loader prüft die gelesene `version` **nicht als harte Versionsschranke**, sondern liefert stets ein neues Objekt mit Version 2 und ausschließlich bekannten Feldern zurück. Unbekannte Felder gehen im Rückgabeobjekt verloren. `strictStorage=true` reicht Parsing-/Zugriffsfehler weiter, verhindert aber nicht alle stillen inhaltlichen Normalisierungen oder die Rückgabe eines Initialzustands für strukturell falsches JSON.

Der Reader allein speichert nicht. `App` hydriert nach Erwerb der Writer-Sperre jedoch mit `loadGamificationState(true)` und schreibt den Zustand anschließend über `commitGamification` zurück. **Katalogfilterung oder verlorene unbekannte Felder können dadurch beim normalen Start dauerhaft werden.** Das ist ein bestätigter Datenfluss; ein realer Datenverlust durch eine Companion-Migration wurde nicht beobachtet, da diese noch nicht existiert.

### 2.4 Alle regulären lokalen Speicherverträge

Die folgenden sieben Keys stehen zugleich in `BACKUP_KEYS`. Der Audit fand im regulären App-Code keine persistente Companion-Auswahl.

| LocalStorage-Key | Format / Inhalt |
| --- | --- |
| `mission.gamification.v1` | Payload Version 2, obiger Fortschritt/Besitz/Kaufjournal |
| `mission.saved-mission.v1` | Getrennter `form`-/`mission`-Snapshot, Timerwerte, `activeSession`, optionale `focusBlocks`, letzte fünf Historieneinträge; kein explizites Top-Level-`version`-Feld |
| `mission.statistics.v1` | Payload Version 1: Tagesaggregate, Ziele, `accountedThrough`, `pending`, Sessionzähler; 400 Tage Retention |
| `mission.templates.v1` | Payload Version 1: lokale `templates`, maximal 100; keine Orb-/Gamification-Felder |
| `mission.focus-environment.v1` | Roher String `still`, `deep-space`, `nebula` oder `liquid`, kein JSON-Envelope |
| `mission.onboarding.v1` | Payload Version 1 mit Tourstatus |
| `mission.projects.v1` | Payload Version 1 mit Projekten; Projekt-/Roadmap-Daten besitzen ebenfalls Versionsregeln im gemeinsamen Schema |

Quellen: [`App.readSavedMission`](../src/App.tsx), [`learningHistory`](../src/services/learningHistory.ts), [`learningStatistics`](../src/services/learningStatistics.ts), [`missionTemplates`](../src/services/missionTemplates.ts), [`focusEnvironment`](../src/services/focusEnvironment.ts), [`onboarding`](../src/services/onboarding.ts), [`longTermProjectSchema`](../shared/longTermProjectSchema.mjs).

History hat keinen getrennten Key und ist keine Quelle des Orb-Besitzes oder der gesamten Fokuszeit. Ein Companion-Migrationsschritt darf keine neuen Mission-/Session-IDs erzeugen. Reload startet den Timer konservativ angehalten; laufende monotone Zeitanker werden nicht aus Offline-Uhrzeit rekonstruiert.

### 2.5 Backup, Export und Import

**Vollbackup:** `{format:'mission-backup', version:1, exportedAt, data}`. `data` ist eine Teilmenge der sieben bekannten Keys; Werte sind geparste Datenobjekte, mit Ausnahme des rohen Umgebungsstrings. Maximal 2 MiB.

`parseBackup` lehnt unbekannte Top-Level-, Daten- und Gamification-Felder ab. Für Gamification verlangt es Payload-Version 2, bekannte normale Besitz-IDs, gültige Kosmetik und `canEquipOrb` für die Auswahl. Coins und Fokusmillisekunden müssen sichere nichtnegative Ganzzahlen sein. Listen sind eindeutig, maximal 20.000 Einträge, Stringlänge bis 240; ausgerüstete IDs haben zusätzlich begrenzte Textlängen. Statistik ohne Gamification oder `accountedThrough > totalFocusMilliseconds` wird abgelehnt.

`exportBackup` liest Rohwerte der Allowlist und prüft das Ergebnis selbst über `parseBackup`. Es ist **kein** allgemeiner Export beliebiger beschädigter Rohdaten. `replaceLocalData` validiert nochmals, verlangt Bestätigung, ersetzt vorhandene Schlüssel und entfernt fehlende Allowlist-Schlüssel. Bei Schreibfehler versucht es die vorherigen sieben Werte zurückzuschreiben. Das ist Best-Effort-Recovery bei abgefangenen Fehlern, **keine transaktionale Garantie bei Prozessabbruch zwischen mehreren Keys**. Auch die Rückschreibung kann fehlschlagen; dafür existiert ein eigener Fehlertext.

Die aufrufende UI erlaubt diese Datenaktionen nur mit Writer-Berechtigung und angehaltenem Timer sowie ohne laufende Planungsoperation; der Service selbst erwirbt die Sperre nicht. Nach erfolgreichem Ersetzen wird die App neu geladen. Fehlende neue Companion-Keys wären heute weder exportiert noch gelöscht noch auf Konsistenz geprüft.

**Ältere Backups:** Ein älteres tatsächlich gültiges `mission-backup` Version 1 mit gültigem Gamification-v2-Payload ist der konkrete Kompatibilitätsfall. Der tolerante lokale Loader kann außerdem ältere flache Missionen oder XP-Daten lesen; daraus folgt **nicht**, dass `parseBackup` solche alten Rohformate akzeptiert. Schon heute ist der Backup-Vertrag enger als der Ladevertrag. Das in `localBackup.test.ts` verwendete Fixture mit sechs Keys belegt nicht ein Limit von sechs: Projekte sind der siebte optionale Allowlist-Key.

**Vorlagenexport:** [`exportTemplate` / `importTemplate`](../src/services/missionTemplates.ts) verwenden separat `mission-template`, Version 1, maximal 256 KiB. Import erhält neue lokale ID und Herkunft `imported`. Vorlagen haben keinen Orb-Besitz, keine Coins und keine Companion-Auswahl. Dieses Format ist nicht als Inventarbackup zu erweitern.

## 3. Abhängigkeiten einer späteren Integration

### 3.1 UI und Geometrie

- [`GamificationPanel`](../src/components/GamificationPanel.tsx): `getEquippedOrb`, Orb-Name, Seltenheits-/Effektklassen, levelabhängige Größe, messbarer Dashboard-Ref.
- [`FocusMode`](../src/components/FocusMode.tsx): Prop `orb: OrbDefinition`, `OrbVisual`, großer Countdown **über dem Orb**. Derselbe Countdown würde ein Companion-Gesicht verdecken; die spätere Anordnung ist eine offene UX-Entscheidung, kein reiner Komponentenimport.
- [`MobileNavigation`](../src/components/MobileNavigation.tsx): echter Orb als zentraler Button, 44–64-px-Begrenzung und Ref für die Transition. Kopf-/Ohren müssen innerhalb der Touchfläche bleiben.
- [`focusTransition`](../src/services/focusTransition.ts) und [`useFocusTransition`](../src/components/useFocusTransition.ts): Ursprung enthält `orbId`; Animation startet nur bei identischer Ziel-ID. `orb-default`/`null` und eine neue Companion-Identität dürfen nicht ungeprüft vermischt werden. Ein geplanter generischer Visual-Key müsste Quelle und Ziel konsistent bezeichnen. Dashboard misst derzeit teils den gespeicherten Orb-Wert, mobile Aktion den aufgelösten Orb.
- [`orbSize`](../src/services/orbSize.ts), [`OrbVisual`](../src/components/OrbVisual.tsx), [`index.css`](../src/index.css): quadratische Darstellungsbox, runde Mission-Core-Container, `overflow`, Orb-spezifische Oberflächen-/Effektklassen. Eine Katze kann in einem Orb-Kreis abgeschnitten werden. Wachstum und Reduced Motion müssen neu gerendert, nicht neu berechnet werden.
- [`OrbCrateShop`](../src/components/OrbCrateShop.tsx), [`OrbCollectionDialog`](../src/components/OrbCollectionDialog.tsx), [`PrestigePanel`](../src/components/PrestigePanel.tsx): Katalogdefinitionen und Orb-Rendering sind direkte Abhängigkeiten; Tastaturfokus, Portal, Scrollbereich und Kaufbestätigung erhalten.
- [`GamificationDebug`](../src/components/GamificationDebug.tsx), Prestige-Vorschauen, Spotlight-Texte und Info-/Datenschutzhinweise benötigen bei späterer Produktumstellung eine sprachliche/visuelle Prüfung, aber keine Fortschritts-Neuberechnung.

### 3.2 Companion ist aktuell kein Inventar

`MissionCompanion` akzeptiert `skin`, `state`, `size`, `animated`, `className`, `label`, `silhouette`. `companionSkins` kennt nur die drei visuellen IDs `luna`, `milo`, `nova`; keine Seltenheit, Erwerbsquelle, Besitzliste, Level oder Prestige-Berechtigung. Es existiert insbesondere keine semantische Zuordnung eines normalen/Prestige-Orbs zu einem Skin.

[`main.tsx`](../src/main.tsx) importiert die Preview nur für DEV, Loopback-Host und `?preview=companion`. Der bestehende Produktionsbundle-Test verlangt derzeit ausdrücklich, dass Companion-/Preview-Code fehlt. Eine produktive Integration müsste diese Erwartung gezielt trennen: der Renderer dürfte ausgeliefert werden, Dev-Preview und Dev-Aktionen weiterhin nicht. Unverändertes Beibehalten des aktuellen Bundle-Tests würde die beabsichtigte Integration verhindern.

Die Zustände sind rein visuell. `success`/`levelUp` führen keine Belohnung aus; ihre Animationen starten beim Eintritt/Mount. Eine Integration muss tatsächliche Session-/Level-Ereignisse abbilden, ohne aus Re-Renders oder Dev-Test-Leveln neue Celebrations oder Berechtigungen abzuleiten. Verhalten bei gleichzeitiger Pause, Offline-Status und Fehler ist noch nicht produktseitig priorisiert.

### 3.3 Tabs, Offline und PWA

`MISSION_WRITER_LOCK = 'mission.app.writer.v2'` ist ein **Web-Lock-Name**, kein LocalStorage-Key. Er umfasst Timer und Käufe innerhalb dieser Origin. Andere Tabs hören auf `storage`, hydrieren nur ohne Writer-Besitz und laden vor Übernahme erneut. Ohne Web Locks bleibt Schreiben gesperrt. Die Sperre schützt nicht vor einem alten Client, der später exklusiv mit veralteter Schema-Logik schreibt.

[`pwaBuild`](../server/pwaBuild.mjs) erzeugt gehashte Cache-Namen und eine statische Precache-Liste. [`serviceWorker`](../server/serviceWorker.js) cached App-Shell/Assets, nicht LocalStorage oder `/api/*`. Er verwendet weder `skipWaiting` noch `clients.claim`; ein Update lädt die aktive Session nicht automatisch neu. [`initializePwa`](../src/services/pwa.ts) registriert produktiv den Worker und meldet wartende Updates. Navigation ist network-first mit statischem Offline-Fallback.

Dadurch können alte/neue Build-Stände während eines Rollouts nacheinander oder in verschiedenen Clients derselben Origin vorkommen. Ein Cache-Update migriert keinen Spielstand. Eine Offline-Installation erhält neue Companion-Assets erst mit erfolgreichem App-Update. Bereits installierte alte Builds müssen ihre alten lokalen Verträge weiter lesen können. Weder Cache-Löschen noch neue Installation darf als Datenmigration missbraucht werden.

## 4. Risiken

Einschätzungen für eine **naive direkte Ersetzung**, keine gemessenen Ausfallquoten. Hoch/mittel/niedrig beziehen sich auf die bedingte technische Wahrscheinlichkeit beim genannten Vorgehen.

| Risiko | Schwere | Wahrscheinlichkeit | Begründung und erforderliche Gegenmaßnahme |
| --- | --- | --- | --- |
| Besitzverlust durch Entfernen alter Katalog-IDs | Kritisch | Hoch | Loader filtert und Writer speichert zurück. Alle 40 IDs erhalten oder verlustfrei archivieren, bevor Kataloge entfallen. |
| 45 freischaltbare Orbs auf 3 Starter reduzieren | Hoch | Hoch | Kein Mapping vorhanden; differenzierter Sammlungsvorteil ginge verloren. Keine automatische Viele-zu-drei-Konvertierung. |
| Ungültige Ausrüstung / falscher Standard | Mittel | Hoch | `null` ist Standard, nicht `orb-default`; `canEquipOrb` kennt keine Skin-IDs. Getrennte diskriminierte Auswahl und geprüfter Resolver. |
| Alte Clients überschreiben neue Felder/Version | Kritisch | Mittel bis hoch | Loader ignoriert unbekannte Versionen/Felder und schreibt v2 zurück; Web Lock verhindert das semantisch nicht. Bestehenden Payload unverändert lassen, gemischte Builds testen. |
| Doppelte Rewards/Abzüge nach Migration | Hoch | Mittel | Verlust des Kaufjournals, neue Zufallswürfe oder Replay alter Käufe. Journale unverändert halten, keine Reward-/Kauffunktionen im Migrator. |
| Guthaben verändert | Hoch | Mittel | Coins können aus Ausgaben/Dev/Import stammen; Formel aus Fokuszeit rekonstruiert kein Guthaben. Exakte Übernahme statt Neuberechnung oder Entschädigung ohne Produktfreigabe. |
| Prestige falsch freigeschaltet | Hoch | Mittel | Legendary ist nicht gleich Prestige; Rang kommt aus Millisekunden, nicht Besitz/History/Dev-Vorschau. Bestehende Schwellen und deterministische Berechtigung verwenden. |
| Alte gültige Backups abgewiesen | Hoch | Hoch bei Vertragswechsel | Parser ist strikt bei Version, Feldern und Katalogen. Explizite alte Decoder und geprüfte Normalisierung vor neuem Vertrag. |
| Wiederholte Migration vervielfacht Inhalte | Hoch | Mittel | Append/Reward-Replay erzeugt doppelte Rechte. Reine deterministische Transformation und Idempotenztests, Marker allein genügt nicht. |
| Teilweise beschädigte Daten werden überschrieben | Hoch | Mittel | Normalisierung kann Felder verwerfen; normales Backup kann bereits scheitern. Rohdaten vor Schreibversuch sichern, gültige Teilwerte nicht mit Defaults überschreiben. |
| Reload/Crash zwischen mehreren Keys | Hoch | Mittel | LocalStorage hat keine Mehrschlüssel-Transaktion; bestehender Restore rollt nur abgefangene Fehler zurück. Neuer Zustand möglichst in einem atomar gesetzten Envelope, expliziter Recovery-Pfad. |
| Quota/Storage-Sperre/fehlende Web Locks | Hoch | Mittel | Kein sicherer Commit möglich. Vorherigen Zustand unverändert lassen, keine halb aktivierte Migration; UI darf weiterhin lesend funktionieren. |
| Offline/PWA mit veraltetem Build | Hoch | Mittel | Alte Decoder und neue Daten können zusammentreffen; fehlende Assets sind nicht durch Netzwerkanfragen zu erzwingen. Rückwärtslesbarkeit, Legacy-Renderer und Offline-Smoke-Test. |
| Gleiche Origin / andere Origin verwechselt | Hoch | Mittel bei Hostingwechsel | Web/PWA teilen je nach Browserkontext Origin-Speicher, aber kein geräteübergreifendes Backup. Neue Domain/Browser kann leer beginnen. Origin beibehalten; bewusster Export/Import bei Wechsel. |
| Neue Auswahl fehlt in Backup/Löschung | Mittel | Hoch ohne Anpassung | Eigener Key ist heute nicht in `BACKUP_KEYS`. Export, Restore und Mission-eigene Datenlöschung gemeinsam erweitern. |
| Timer verdeckt Gesicht / Ohren abgeschnitten / FLIP übersprungen | Mittel | Hoch bei einfachem Austausch | Countdown-Overlay, Kreiscontainer und Orb-ID-Vergleich sind konkret vorhanden. UI-Layout und Visual-Identität separat abnehmen. |

Datenschutz: Eine lokale Transformation benötigt weder neue Logs noch Netzwerk. Rohbackups enthalten auch persönliche Lerntexte; nicht in Serverlogs, Feedback-Links oder öffentliche Issues aufnehmen. Das Audit kann keine Wiederherstellung garantieren, wenn Browserdaten bereits gelöscht oder historische Rechte früher herausgefiltert wurden.

## 5. Vergleich der Strategien

### A — Bestehende Orb-Daten erhalten, additive Kompatibilitätsschicht

Orb-IDs, Kataloge, Berechtigung, Crate-Regeln und Gamification-Payload bleiben bestehen. Eine künftige Darstellungsauflösung könnte zwischen vorhandenen Orb-Rechten und kostenlosen Starter-Skins unterscheiden. Eine spätere optionale persistente visuelle Präferenz wäre **ein neuer, separat versionierter Vertrag**, nicht `equippedOrbId = 'luna'`.

Vorgeschlagenes Auswahlprinzip, noch keine festgelegte API: eine diskriminierte Wahl zwischen „bestehender Orb einschließlich Standard“ und „Starter-Skin“. Aktuelle `equippedOrbId` bleibt als Legacy-Auswahl erhalten. Bei unbekannter neuer Präferenz nur die Darstellung sicher zurückfallen lassen; nicht den gültigen Orb-Besitz neu speichern oder löschen.

Solange kein genehmigtes 40-/5-Orb-Mapping existiert, müssen vorhandene Orbs weiter sichtbar, auswählbar und renderbar bleiben. A ist ein risikoarmer Übergang, **noch keine vollständige Ablösung aller Orb-Inhalte**.

### B — Eigenes Companion-Inventar mit versionierter Migration

Neuer persistenter Inventarvertrag für Starter, künftig normale und Prestige-Inhalte, einschließlich ursprünglicher Herkunft/Legacy-Referenz. Vor jeder Migration braucht es eine freigegebene vollständige Zuordnung aller 40 normalen und fünf Prestige-Rechte sowie Standardverhalten. Alte IDs und Rohdaten bleiben für Recovery erhalten.

Auch B sollte Coins und Fokuszeit weiterhin im vorhandenen Fortschrittsvertrag belassen, statt eine zweite autoritative Ökonomie aufzubauen. Ein neues Inventar darf Erwerbsrechte abbilden, aber keine unabhängige Kopie von Level/Prestige/Fokuszeit führen. In-place-`version:3` im bisherigen Gamification-Key ist mit dem aktuellen alten Reader besonders gefährlich.

| Kriterium | A: Additiver Adapter | B: Neuer Inventarvertrag |
| --- | --- | --- |
| Komplexität | Niedrig bis mittel; zwei Darstellungsarten zeitweise sichtbar | Hoch; Mapping, Migrator, alte Decoder, Recovery, Koexistenz |
| Datenschutz | Lokal; minimal zusätzliche Präferenz | Ebenfalls lokal möglich; mehr Archiv-/Backup-Daten und Validierung |
| Rückwärtskompatibilität | Hoch für unveränderten Orb-Payload; neue Präferenz/Backups dennoch separat absichern | Nur mit expliziten Altformaten und Rolloutregeln; alte Apps verstehen das Inventar nicht |
| Erweiterbarkeit | Gut für Startauswahl, begrenzt für viele Erwerbsquellen | Besser für ein später eigenständiges Companion-Inventar |
| Testaufwand | Adapter, Präferenz, UI, Backup, gemischte Clients | Zusätzlich jede Mapping-Zeile, Versionen, Teilzustände, Wiederanlauf, Downgrade |
| Migrationsrisiko | Niedrig, solange alte Eigentumsdaten nicht umgeschrieben werden | Hoch, wenn Altbesitz ersetzt oder Auswahl/Ökonomie neu interpretiert wird |
| Wartbarkeit | Klar begrenzte Übergangsschicht; langfristig doppelte Begrifflichkeit | Sauberer Zielvertrag, aber dauerhaft unterstützte Legacy-Decoder/Archive nötig |

### Empfehlung

**A als nächste Implementierungsrichtung**, zunächst ohne Besitzmigration und ohne Umbenennung bestehender Keys. Begründung: Der aktuelle Fortschritts-/Kaufpfad ist konsistent orbgebunden, der Reader filtert IDs und ignoriert Versionsschranken, der Backup-Vertrag ist strikt, und es existieren lediglich drei kostenlose Companion-Grafiken statt 45 genehmigter Nachfolger. Eine sofortige B-Migration wäre deshalb sowohl technisch riskanter als auch produktseitig unvollständig.

B erst erneut entscheiden, wenn das Zielinventar und das Mapping genehmigt sind. A darf nicht unbemerkt zu einem zweiten Reward-System anwachsen. Falls langfristig ausschließlich Companions sichtbar sein sollen, braucht auch A eine ausdrücklich freigegebene Anzeige/Weiterführung des Altbesitzes; „nicht mehr rendern“ ist keine Besitzstrategie.

## 6. Kostenlose Starter: feste Vorgaben und offene Verbindung zur Sammlung

Vorgegeben: `luna`, `milo`, `nova` sind kostenlose Starter; Auswahl ist kein Kauf, kein Zufallsdrop und keine Echtgeld-Lootbox. Die bestehenden Skin-IDs bleiben unabhängig von späteren Anzeigenamen.

Empfohlene technische Trennung:

- Starter-Verfügbarkeit wird aus dem Starter-Katalog abgeleitet, nicht durch drei fiktive Crate-Käufe oder Einträge in `ownedOrbIds` erzeugt.
- Eine ausdrückliche Starter-Auswahl verändert nur die künftige visuelle Präferenz; niemals Coins, Fokuszeit, Prestige, Kaufjournal oder historischen Besitz.
- Ein separater Starter-Bereich in der Sammlung kann später die Auswahl darstellen, während vorhandene Orb-/Prestige-Rechte weiterhin nachvollziehbar sind.
- Crates behalten zunächst den bestehenden 40-Orb-Pool. Die drei Starter dürfen diesem Pool nicht hinzugefügt werden. Für einen späteren Companion-Crate-Pool fehlen derzeit nicht kostenlose Inhalte und eine freigegebene Erwerbszuordnung.
- Die fünf Prestige-Orbs bleiben zunächst echte eigene Rechte. Kein kostenloser Starter wird als Ersatz für einen verdienten Prestige-Orb ausgegeben. Spätere Prestige-Companions sollten aus dem tatsächlichen Rang abgeleitet werden, nicht durch wiederholt ausgeführte „Unlock“-Belohnungen.

**Offen:** Bleiben alle drei Starter dauerhaft frei wechselbar oder ist es eine einmalige Gratiswahl? Bedeutet Starter-Auswahl „Orb vorübergehend als Begleiter ersetzen“, „Orb-Skin auf Companion anwenden“ oder „separate Figur plus Sammlung“? Wird bei Bestandsnutzern zunächst der vorhandene Orb gezeigt oder eine Wahl angeboten? Die Komponente hat technisch Default Luna; daraus folgt keine genehmigte Produktentscheidung zur automatischen Ausrüstung.

## 7. Konkrete, unabhängig prüfbare Implementierungsphasen

Keine dieser Phasen wurde hier umgesetzt. Jede Änderung über die Analyse hinaus benötigt einen eigenen Auftrag; neue Speicherverträge insbesondere ausdrückliche Freigabe gemäß `AGENTS.md`.

### D2 — Produkt-/Vertragsentscheidung und feste Invarianten

Entscheidungen aus Abschnitt 9 schließen, synthetische Altformat-Fixtures und unveränderliche Katalog-/Journal-Erwartungen definieren. Noch keine UI-/Storage-Änderung.

**Abnahme:** Alle 46 Render-IDs und 45 freischaltbaren Rechte sind einzeln adressiert; Starter sind nicht im Droppool; unveränderte Coins/Fokuszeit und bestehende Prestige-Schwellen sind verbindlich. Falls noch kein Mapping genehmigt ist, wird ausschließlich A mit erhaltenem Legacy-Inventar freigegeben.

### D3 — Reiner Darstellungs-/Berechtigungsresolver

Eine separat testbare, nebenwirkungsfreie Auflösung für Legacy-Orb oder Starter entwerfen. Keine Migration, Zufallswerte oder Storage-Schreibvorgänge. Fehlende neue Auswahl lässt Bestandsausrüstung bestehen; ungültige Auswahl fällt deterministisch auf eine genehmigte verfügbare Darstellung zurück.

**Abnahme:** Input bleibt unverändert; normale Besitzprüfung und echte Prestige-Grenzen bleiben wirksam; `null`/`orb-default` sind korrekt getrennt; jeder Starter lässt sich ohne Coin-Prüfung entsprechend Produktregel auswählen. Dev-Level und Prestige-Vorschau erzeugen keine Berechtigung.

### D4 — Präferenzvertrag, Backup und Recovery vor produktivem Einschalten

Falls A eine persistente Auswahl erhält: neuer kleiner versionierter Präferenz-Envelope mit strikt erlaubten Feldern und IDs, unter bestehendem Writer-Lock. Exakter Key, Default und Lösch-/Restore-Semantik erst freigeben. Keine neue Besitzliste für kostenlose Starter und keine Änderung am Gamification-v2-Payload.

Backup-Allowlist, Parser, Export, bestätigtes Ersetzen und Datenlöschung gemeinsam erweitern. Empfehlung für neue Exporte mit neuem Vertrag: explizite neue Backup-Version statt vorgetäuschter Altclient-Kompatibilität. Neuer Reader unterstützt das bestehende Version-1-Backup und den genehmigten neuen Vertrag über getrennte Decoder; alte Reader dürfen neue Backups klar ablehnen. Nicht pauschal unbekannte Felder erlauben.

**Abnahme:** Auswahl über Reload erhalten; altes Backup ohne Präferenz wird vollständig und ohne Restpräferenz wiederhergestellt; neue Backups enthalten keine zusätzlichen privaten Informationen; Fehler verändern gültige Altwerte nicht. Keine versteckte neue Auswahl durch Export/Import. Fremde Storage-Keys bleiben unverändert.

### D5 — Produktionseinbindung, weiterhin reversible Darstellung

Zuerst Mission Core, dann mobile Fokusaktion, Fokusmodus/Transition, schließlich Sammlung und Prestige-Anzeige jeweils getrennt implementieren. Gemeinsame Visual-Identität, wachsende Größe, lesbarer Timer und Accessibility abnehmen. Produktive Renderer-Imports erlauben; Dev-Preview/-Tools im Produktionsbundle weiterhin ausschließen. Keine Änderung an Crate-Ökonomie ohne separaten Auftrag.

**Abnahme je Oberfläche:** Kein Neustart/Ende einer Session durch Visual-Wechsel; keine Coins/Fokuszeit/Historyänderung; keine abgeschnittenen Ohren; Countdown verdeckt kein Gesicht; Transition konsistent, ohne Reward-Replay; Tastatur, Mobile, Reduced Motion und Sichtbarkeit geprüft.

### D6 — PWA-/Altclient-Rollout und Recovery-Abnahme

Zwei Builds derselben Origin mit alter/neuer App und zwei Tabs testen. Neuer Stand muss nach alten Orb-Käufen erneut korrekt auflösen. Alten Gamification-Payload nicht mit neuen Feldern überladen. Vor einer späteren destruktiven B-Migration alle alten Clients schließen lassen und klaren Upgrade-/Recovery-Pfad vorsehen; ein Web Lock allein reicht nicht als Versionsbarriere.

**Abnahme:** Offline-Neustart nach vorherigem Laden, angehaltener Timer, identische Guthaben, alte Auswahl weiter gültig; fehlgeschlagenes SW-Update lässt vorige App nutzbar; kein Cache- oder LocalStorage-Global-Clear.

### Optional später: B1/B2 — Versionierte Eigentumsmigration

Nur nach eigenem Beschluss und genehmigtem vollständigem Mapping: reine Funktion `Altformat → Zielinventar + explizite Warnungen` zuerst ohne IO testen. Alle Legacy-Rechte mit Herkunft behalten; Quelle und Ziel validieren. Danach getrennt kontrollierter, möglichst einteiliger Commit unter Writer-Sperre mit Rohdaten-Recovery. Nicht einmalig nur einem Marker vertrauen: wiederholte Eingabe, spätere alte Orb-Käufe und alte Backup-Restores müssen konsistent neu abgeglichen werden, ohne neue Auswahl oder neue Rechte zu überschreiben.

**Abnahme:** Deterministisch und idempotent; jeder gültige Altbesitz repräsentiert; keine künstlichen Crate-Käufe, IDs oder Coins; unbekannte Zukunftsversion nicht als leerer Spielstand normalisiert und gespeichert. Alte Quelle erst nach gesonderter Freigabe überhaupt zur Entfernung erwägen.

## 8. Test- und Recovery-Plan

### 8.1 Vorhandene Regressionen weiterverwenden

- [`gamification.test.ts`](../src/services/gamification.test.ts): XP-Archiv, Besitz, Ausrüstung, Teilminuten, Level, Schritte/Abschluss ohne Belohnung, beschädigte Fokuszeit.
- [`orbCrates.test.ts`](../src/services/orbCrates.test.ts), [`App.crates.test.tsx`](../src/App.crates.test.tsx): 40 IDs, Wahrscheinlichkeitsgrenzen, 29/30/60 Coins, Duplikate, einmalige Kauf-IDs, Persistenz vor Animation, zweiter Tab.
- [`prestige.test.ts`](../src/services/prestige.test.ts), [`prestigeOrbs.test.ts`](../src/services/prestigeOrbs.test.ts), [`App.prestigeOrbs.test.tsx`](../src/App.prestigeOrbs.test.tsx): Millisekunden-Grenzen, fünf Rechte separat vom Pool, Fake-Besitz/Dev-Vorschauen, Reload.
- [`localBackup.test.ts`](../src/services/localBackup.test.ts): Format/Größenlimit, bestätigtes Ersetzen, keine fremden Keys/Secrets, Best-Effort-Rollback. Fehlertest mit abgefangener Exception ersetzt keinen Crash-Test zwischen Schreiboperationen.
- [`focusTimer.test.ts`](../src/services/focusTimer.test.ts), [`App.focusBlocks.test.tsx`](../src/App.focusBlocks.test.tsx), [`App.focus.test.tsx`](../src/App.focus.test.tsx), [`App.statistics.test.tsx`](../src/App.statistics.test.tsx): Writer-Transfer, Vergütung, Pause, Reload, Journalkonsistenz.
- [`App.collection.test.tsx`](../src/App.collection.test.tsx), [`focusTransition.test.ts`](../src/services/focusTransition.test.ts), [`orbSize.test.ts`](../src/services/orbSize.test.ts): Standardauswahl, Dialog, Wachstum, Transition.
- [`companionSkins.test.tsx`](../src/components/companionSkins.test.tsx), Companion-Motion-Tests, [`prestige.production.test.ts`](../src/services/prestige.production.test.ts), [`pwa.test.mjs`](../server/pwa.test.mjs): gemeinsame Geometrie, reine Preview, Produktionsgrenzen und statischer Cache.

### 8.2 Zusätzliche Abnahmematrix für eine Implementierung

| Fall | Prüfkriterium |
| --- | --- |
| Frischinstallation, keine Keys | Genehmigte kostenlose Starterwahl, keine erfundenen Käufe/Coins/Fokusminuten; Standardfall eindeutig |
| Jeder normale Orb einzeln, alle 40 zusammen | Besitz nach Laden/Adapter/Export/Restore identisch; keine Zusammenlegung auf nur drei Skins |
| Standard mit `equippedOrbId:null` | Kostenlos verfügbar; nicht als unbekannte Besitz-ID serialisieren |
| Prestige je Schwelle −1 ms / exakt / +1 ms | Ausschließlich berechtigte Stufen, alle niedrigeren verfügbar; 1.000 h nicht vorzeitig |
| Ausgerüsteter normaler bzw. Prestige-Orb | Bestehende Auswahl und Rechte bei neuer Darstellung/Reload erhalten |
| Älteres gültiges Vollbackup v1 | Expliziter Decoder, keine Daten-/Reward-Erzeugung; alte Auswahl bleibt oder genehmigter Präferenz-Default |
| Legacy-XP-/flaches Rohformat | Erst vom echten Backup-Format unterscheiden; getesteter Migrationspfad statt pauschaler Importannahme |
| Ungültige Auswahl bei gültigem Besitz | Sicherer Anzeige-Fallback, gültiger Besitz bleibt; Rohwert für Recovery nicht vorzeitig überschreiben |
| Fehlerhafte Zahl, ungültiges JSON, unbekannte IDs | Kein pauschales Zurücksetzen gültiger Coins/Besitzstände; Warnung/Quarantäne nach freigegebener Regel |
| Unbekannte zukünftige Version | Kein Downgrade-Schreiben durch neuen Migrator; alte Clients separat berücksichtigen |
| Wiederholte Migration / mehrfacher Reload | Identisches Ziel, unveränderte Guthaben und Journale; kein neues UUID-/Zufalls-/Reward-Replay |
| Neue echte Orb-Käufe nach erster Auflösung | Additiver Abgleich erhält neue Rechte und respektiert bestehende visuelle Auswahl |
| Zweiter Tab / Writer-Wechsel / alter Build | Neu lesen vor Schreiben; kein veralteter Ref-Commit, keine doppelte Kaufverarbeitung |
| Abbruch vor Commit / nach einzelner Key-Operation | Bisheriger Stand lesbar oder klar recoverbar; Marker allein aktiviert keinen unvollständigen Zielstand |
| Quota/Storage-Ausfall auch während Rollback | Keine automatische Belohnung; verständlicher Recovery-Hinweis und originales externes Backup erhalten |
| Restore alter Daten nach neuer Auswahl | Neue Präferenz konsistent löschen/defaulten; nicht alte Fokuszeit mit unberechtigten Prestige-Rechten kombinieren |
| 25/5, 50/10, Custom, Stoppuhr | Nur echte Fokusphasen vergütet, keine Migration verändert Timer-/History-/Statistikwerte |
| Offline-App / installierte PWA | Assets vorher verfügbar, Reload pausiert, keine Offline-Zeitgutschrift; keine Migrations-Netzwerkabhängigkeit |
| Alte/new SW-Version und mehrere Clients | Kein erzwungenes Session-Reload, kein Datenlöschen, Legacy-Pfade bleiben nutzbar |
| Starter-Auswahl und Collection | Keine Crate-Abbuchung, keine fiktiven Besitz-/Kaufjournal-Einträge; kostenlose Regel nachvollziehbar |
| Backup-/Datenlöschung | Alle genehmigten neuen Keys erfasst, fremde Daten unverändert; unbekannte Felder weiterhin abgelehnt |
| Visuelle Regression | 60/120/200 px, schmale Viewports, Timerlesbarkeit, Größenwachstum, Transition, Fokusführung und Reduced Motion |

Bei synthetischen Fixtures gesamte nicht kosmetische Daten vor/nach vergleichen, nicht nur Coins: Fokusmillisekunden, Statistik inklusive Journal, Mission-/Session-IDs, erledigte Schritte, Pausen-/Timerwerte und History müssen identisch bleiben. Die Historie darf nicht zur Neuberechnung der Gesamtzeit herangezogen werden.

### 8.3 Recovery und Rollback

1. Vor jeglichem späteren Schreibpfad Originalwerte sichern und Speicherfähigkeit prüfen. Bei beschädigten Daten kann der normale Vollbackup-Export scheitern; ein gesonderter, bewusst lokaler Rohdaten-Recovery-Weg wäre vor destruktiver Migration zu spezifizieren, nicht still zu implementieren.
2. Migration nur bei angehaltener Session unter vorhandener Writer-Sperre, nach erneutem Einlesen. Quelle nicht schon beim Ermitteln des Mappings normalisiert überschreiben. Erst reine Transformation und komplette Validierung, danach Commit.
3. A: Darstellung/Adapter deaktivieren und den erhaltenen Orb-Payload verwenden. Eine neue Präferenz darf ignoriert werden, ohne Guthaben oder Fokuszeit zurückzudrehen. Dies ist ein UI-Rollback, kein Wiederherstellen eines veralteten gesamten Spielstands.
4. B: Rohquelle plus verlustfreie Legacy-Referenzen behalten. Ein Zustand gilt nur als aktiv, wenn sein vollständiger Envelope gültig ist. Bei fehlendem/fehlerhaftem Ziel zurück zur gültigen Quelle oder klarer Recovery-Ansicht, nicht zu leeren Default-Daten.
5. Bei Mehrschlüssel-Restore Schreibfehler und Prozessabbruch getrennt behandeln. Der heutige `replaceLocalData`-Rollback reicht für eine neue Crash-sichere Migrationszusage nicht aus. Ein neuer Commit-/Recovery-Vertrag muss vorher getestet werden; keine Garantie aus dem heutigen Code ableiten.
6. Alte Backups nur nach ausdrücklicher Bestätigung ersetzen lassen. **Kein automatisches Zurückspielen alter Coins/Fokuszeit nach späterem Fehler:** Seit dem Backup real erworbener Fortschritt würde sonst verloren gehen. Ein vollständiger Restore ist eine bewusste Nutzeraktion mit transparentem Datenstand.
7. Keine alten Journale oder Legacy-Kataloge während des ersten Rollouts entfernen; keine pauschale Cache-/Storage-Löschung. Nur eindeutig Mission-eigene, genehmigte neue Keys später gezielt bereinigen.

## 9. Offene Produkt- und Vertragsentscheidungen

Vor einer produktiven Umsetzung ausdrücklich entscheiden:

1. **Altbesitz:** Bleibt die Orb-Sammlung dauerhaft verfügbar, wird sie als Legacy-Inventar gezeigt oder gibt es später eine eindeutige wertwahrende Zuordnung zu neuen Inhalten? Alle 40 normalen und fünf Prestige-Rechte benötigen eine Antwort.
2. **Starterwahl:** Einmalig oder jederzeit wechselbar? Default bei frischer und bestehender Installation? Bestehende Ausrüstung keinesfalls still überschreiben.
3. **Beziehung Orb/Companion:** Exklusive visuelle Auswahl oder getrennte Figur plus weiterhin ausgerüsteter Orb? Drei Starter allein beantworten diese Frage nicht.
4. **Crates:** Bleiben sie vorerst Orb-Kisten? Welche nicht kostenlosen Companion-Inhalte und Seltenheiten existieren künftig? Keine Starter zufällig verkaufen oder neue Drop-Raten aus dem Audit ableiten.
5. **Prestige:** Fünf neue exklusive Companion-Skins, andere Kosmetik oder weiterhin Original-Orbs? Rangschwellen bleiben unverändert; keine existierenden Belohnungen vortäuschen.
6. **Speichervertrag:** Exakter neuer Präferenz-/Inventar-Key, Version, erlaubte Felder und Normalisierung? Empfehlung A ist keine Zustimmung zur Änderung vorhandener Verträge.
7. **Backups:** Neue Exportversion und Unterstützung alter gültiger Formate; Verhalten bei fehlender Präferenz und alten Clients. Kein automatischer Merge mit unklaren Kauf-/Fokusrechten.
8. **Beschädigung:** Nur Anzeige-Fallback oder bestätigte Reparatur? Wie wird ein lokales Rohbackup angeboten, wenn der strikte Export bereits scheitert?
9. **UI:** Countdown beim Companion, Sammlungstexte, mobile Zentralaktion und gemeinsame Transition-Identität. Barrierearme Alternative für alle visuellen Reaktionen.
10. **Motion-Ereignisse:** Priorität von Focus/Pause/Error/Offline und Auslöser für wiederholte Success-/Level-Up-Events; Dev-Test-Level darf keine echte Freischaltung darstellen.
11. **Rollout:** Unterstützte Altbuilds, Offline-Dauer, Rollback-Fenster und späterer Umgang mit Legacy-Archiven. Keine Löschfrist ohne ausdrückliche Entscheidung.

## 10. Durchführung dieses Audits

Nur Repository-Dateien und Tests gelesen; keine Render-/Groq-Anfragen, Konten oder Infrastruktur verwendet, keine Migration, kein Zugriff auf echte LocalStorage-Werte. Als einziges neues versionierbares Artefakt wird dieses Audit-Dokument angelegt. Prüfstatus wird im Abschlussbericht genannt; ein erfolgreicher unveränderter Testlauf ist keine bereits implementierte Companion-Migrationsprüfung. Nach Analyse und Bericht endet diese Phase.
