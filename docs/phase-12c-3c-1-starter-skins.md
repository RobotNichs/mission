# Phase 12C.3C.1: Starter Companion Skins

## Aufbau und Kompatibilität

`src/components/companionSkins.ts` definiert den Typ `CompanionSkinId` und genau drei zentrale visuelle Konfigurationen: `luna`, `milo`, `nova`. Anzeigenamen sind davon getrennt. `MissionCompanion` erhält ausschließlich den optionalen Prop `skin`; ohne Angabe gilt `luna`.

```tsx
<MissionCompanion skin="milo" state="idle" size={120} animated />
```

Kopfkontur, Stirnmerkmal-Geometrie, Augen-/Mundformen, alle sieben States, Animationen und Props bleiben gemeinsam. Der Ausdrucksschlüssel hängt weiterhin nur vom State ab; ein Skinwechsel ist kein Belohnungsereignis und remountet die Reaktion nicht. Keine Migration, Persistenz, Freischaltungen oder Integration in produktive Screens. Ungeprüfte externe Skinwerte sind vor einer späteren Integration auf die drei gültigen IDs abzubilden.

Luna verwendet exakt die bisherigen Farbwerte, Opacities und Geometrie. Ohne `skin` und mit explizitem `skin="luna"` erzeugt dieselbe Instanz identisches Markup. Kein zusätzlicher Materialauftrag oder Augenrand für Luna. Ein pixelweiser Vorher-/Nachher-Bildvergleich wurde nicht durchgeführt.

## Farben und Materialien

| Skin | Fellverlauf hell → mittel → dunkel | Augen / Pupillen | Akzente |
| --- | --- | --- | --- |
| Luna | `#3D4B6B` → `#2E3A56` → `#1B2336` | Cream `#F7E6D3` / Navy `#1B2336` | Lavender-Innenohren `#8A7BE0`, Merkmal `#A99BEF`, Peach-Nase `#F5BEA4` |
| Milo | `#FFF0D5` → `#F7DAB7` → `#DFA685` | warmes Cream `#FFF4E3` / Indigo `#29334E`; feiner Augenrand `#7D6270` | Peach-Ohren `#EF9C83`, Lavender-Merkmal `#9A85CF`, dunkle Nase `#514051`, warme Mundlinie `#A96F65` |
| Nova | `#425194` → `#30265B` → `#171C37` | Cream `#F7E6D3` / tiefes Indigo `#171C37` | violette Kontur `#9981D8`, Merkmal `#B6C7F5`, lokales Cyan-Licht `#7DCBE8`, Peach-Nase |

Milo kombiniert einen Cream-/Apricot-Verlauf mit einem sehr schwachen lokalen warmen Highlight. Dunkle geschlossene Lider und eine feine Umrandung offener Augen erhalten die Gesichtskontraste auf dem hellen Fell. Keine roten Wangenflecken oder zusätzlichen Gesichtselemente.

Nova verwendet ein kühles lokales Highlight und vier sehr kleine statische Lichtpunkte. Diese liegen in einem SVG-Füllmuster und werden ausschließlich durch dieselbe Kopfkontur gemalt; außerhalb des Kopfes erscheinen keine Punkte. Unter 80 angeforderten Pixeln entfallen die Punkte vollständig. Farbverlauf, Kontur und Gesicht bleiben auch bei 60 px erhalten. Bereits bestehende Herz-Vereinfachung bleibt unverändert.

Materialfüllungen verwenden Instanz-IDs aus `useId`, wie die bestehenden Verläufe. Keine Filter, externen Assets, Shader oder neuen Animationen. Success-/Level-Up-Impulse nutzen skinspezifische Farben bei unverändertem Timing und Mechanismus.

## Referenz und Grenzen

Die beigefügte Referenz „Mission Companion – Starter-Varianten“ war sichtbar. Ihre drei großen oberen Darstellungen dienen als Farb-/Materialreferenz. Abweichungen sind bewusst: Die bestehende Silhouette und Gesichtsgeometrie haben Vorrang vor der Illustration; Milo bekommt keine größeren Augen oder Wangenflecken, Nova keine großflächigen Lichtausbrüche und keinen dichten Sternenhimmel. Beide bleiben im reduzierten SVG-Stil. Die tatsächliche Kopffarbe und Gesichtskontraste tragen die Unterscheidung, nicht nur der Außen-Glow.

## Lokale Preview

`npm run dev`, danach die ausgegebene Loopback-URL mit `?preview=companion` öffnen, üblicherweise `http://localhost:5173/?preview=companion`.

Oben steht ein direkter Vergleich von Luna, Milo und Nova bei jeweils 120 und 60 px. „Zustand für alle Starter-Skins“ wechselt alle sechs Instanzen gemeinsam. Für erneute Entry-/Celebration-Reaktionen einen anderen State und anschließend den gewünschten State wählen. Die bisherige siebenteilige State-Preview mit ihren manuellen Triggern, 60-px-Auswahl und Reduced-Motion-Simulation bleibt erhalten. Alle Einstellungen sind Runtime-State ohne Speicherung.

## Prüfungen

Automatisierte Tests prüfen gültige IDs, Default-Luna, unveränderte Geometrie bei allen 21 Skin-/State-Kombinationen und drei Größen, unterschiedliche Paletten, messbare Pupillen-/Augen-Kontraste, Milos Augenrand, kleine Nova-Vereinfachung, SVG-Referenzen, Accessibility, Animation aus, Sichtbarkeitspausen, gemeinsame Preview-Steuerung sowie keine Storage-/Netzwerkaktionen. Bestehende Reduced-Motion-/Motion-Tests gelten weiterhin für dieselbe unveränderte CSS-Datei. Ein echter In-Memory-Produktionsbuild prüft den Ausschluss von Preview und Skin-Code.

Zusätzlich wurde die tatsächliche lokale Preview in einem isolierten Headless-Edge bei 1280 px gerendert und der statische 120-/60-px-Skin-Vergleich angesehen. Eine weitere Ansicht mit exakt 375 px CSS-Viewport wurde ebenfalls gerendert, gemessen und angesehen: Der Vergleich stapelt ohne horizontalen Seitenüberlauf. Milo bleibt hell und warm, seine Augen sind abgegrenzt; Nova bleibt violett/kühl und vereinfacht die Punkte bei 60 px. Dies ist eine statische Browser-Rendering-Prüfung, keine echte Geräteprüfung und keine vollständige Animationsabnahme. Die gestalterische Freigabe bleibt beim Nutzer.

Offen: Vergleich aller Gesichtsausdrücke und Celebrations in der interaktiven Preview, subjektive Nähe zur Referenz, reale System-Reduced-Motion, mobile Geräte und weitere Browser. Eine 60-px-Anforderung entfernt Details; ein erst durch einen engen Container verkleinerter größer angeforderter Companion verwendet weiterhin dessen Größenstufe. Lokale Screenshot-/Browserprofile für die Prüfung liegen ausschließlich im ignorierten `node_modules/.cache` und sind keine App-Assets.
