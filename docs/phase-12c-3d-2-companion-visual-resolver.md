# Phase 12C.3D.2: Companion-First Visual Resolver

## API und Grenzen

`src/services/companionVisualResolver.ts` exportiert den unveränderlichen Auswahltyp und die reine Funktion:

```ts
type CompanionVisualSelection = Readonly<{
  kind: 'companion'
  skinId: CompanionSkinId
}>

resolveCompanionVisual(selection?: unknown): CompanionVisualSelection
```

Beispiel: `resolveCompanionVisual({kind: 'companion', skinId: 'milo'})` liefert dieselbe typisierte Identität als neues Objekt. Die Funktion erwartet eine ausdrücklich diskriminierte Auswahl, keinen bloßen Skin-String. Zusätzliche Eingabefelder werden ignoriert und nicht weitergereicht. Nur eigene Einträge der vorhandenen zentralen `companionSkins`-Konfiguration sind gültig; geerbte Objektnamen sind keine Skins. Es gibt keinen zweiten Starter-Katalog.

Alle drei Starter sind unabhängig von Guthaben, Besitz und Fortschritt verfügbar. Deshalb benötigt die Funktion überhaupt keinen Gamification-Parameter. Keine React-/DOM-Abhängigkeit, Speicherung, Netzwerkanfrage, Zufallswerte, Timer oder Reward-Aufrufe. Der Import der reinen Skin-Konfiguration lädt nicht die React-Komponente oder ihre Styles.

## Fallback-Semantik

Fehlende oder ungültige Auswahl liefert deterministisch `{kind: 'companion', skinId: 'luna'}`. Das ist ausschließlich ein technischer Darstellungsfallback. Er speichert keine Nutzerentscheidung, rüstet nichts aus und ersetzt keinen vorhandenen Orb. Jeder Aufruf liefert ein neues Objekt; Eingaben werden nicht verändert.

## Legacy-Kompatibilität

Der Resolver löst bewusst nur Companions auf. Ein kombinierter Auswahltyp oder Orb-Adapter ist in dieser Phase nicht erforderlich. Legacy-IDs sind keine Skin-IDs und werden nicht konvertiert. Wer versehentlich Legacy-Daten an diesen Resolver übergibt, erhält nur dessen technischen Companion-Fallback, keine Aussage über Orb-Berechtigung.

Für Legacy-Darstellungen bleiben `canEquipOrb` und `getEquippedOrb` aus `prestigeOrbs.ts` maßgeblich: gespeicherter Standard ist `null`, `orb-default` nur Render-ID; normale Orbs benötigen Besitz, Prestige-Orbs echte kumulative Fokuszeit. Gefälschter Prestige-Besitz oder ein visueller Dev-Level genügen nicht. Diese Regeln und das Gamification-v2-Format samt Speicher-Key bleiben unverändert.

## Zukünftige Integration und offene Entscheidungen

Companion-First und der Erhalt der Legacy-Sammlung sind Produktvorgaben. Ein späterer Integrationsaufrufer muss ausdrücklich entscheiden, wann er den Companion-Resolver verwendet und wann er weiterhin die Legacy-Darstellung auflöst. Nicht die gesamte App-Auswahl still durch diesen Companion-Fallback ersetzen.

Weiter offen: Standard-/Auswahlangebot für Bestandsnutzer, dauerhaft wechselbare oder einmalige Starterwahl, Präferenzvertrag, Backup-/Restore-Semantik, Collection-Darstellung und die wertwahrende Weiterführung der 45 freischaltbaren Orb-Rechte. Keine Zuordnung auf drei Starter, keine UI-Integration, Datenmigration, neuen Besitzdaten oder Crate-Änderungen wurden implementiert.

## Prüfungen

Gezielte Unit-Tests prüfen alle Starter anhand des zentralen Katalogs, ungültige Eingaben einschließlich geerbter Objektnamen, Determinismus, unveränderte Eingaben und neue Ergebnisobjekte. Ein Node-Test sperrt Browser-/Storage-Zugriffe, Netzwerk, Zufall und Timer auch beim erneuten Modulimport. Legacy-Vertragstests verwenden die bestehenden Berechtigungsfunktionen für alle 40 normalen Orbs und fünf Prestige-Schwellen, gefälschten Besitz, Dev-Level und Standardauswahl. Unterschiedliche Coin-Stände bleiben samt Fokuszeit, Ausrüstung, Besitz, Kauf-/Reward-Journalen und synthetischer Historie unverändert.

Prüfergebnis: 29 gezielte Tests bestanden; vollständige Suite mit 1.147 Tests in 75 Dateien bestanden. `npm run build` einschließlich `tsc -b` und `git diff --check` erfolgreich. Es gibt keine neue Oberfläche oder Animation zur visuellen Abnahme. Diese Tests bestätigen keine bereits umgesetzte produktive Companion-Migration.
