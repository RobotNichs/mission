# Phase 12C.3A: Mission Companion Base

Ein isolierter React-/SVG-Prototyp, ohne Ersatz oder Migration der Orbs. `OrbVisual`, Mission Core, FocusMode, Inventar und Vergütung bleiben unverändert. Kein Speicherzugriff, Provideraufruf oder neues Asset erforderlich.

## API

```tsx
<MissionCompanion size={120} state="idle" animated label="Mission Companion, aufmerksam" />
```

`size` ist eine positive Pixelgröße (Standard 120, ungültige Zahlen fallen auf 120 zurück). `state` erlaubt seit Phase 12C.3B `idle`, `focus`, `success`, `pause`, `error`, `offline`, `levelUp`; Standard ist `idle`. `animated` ist standardmäßig aktiv. `className` ist optional. Ohne `label` ist die Instanz dekorativ und für Screenreader verborgen. `silhouette` zeigt ausschließlich dieselbe monochrome Kopfkontur ohne Gesicht oder Glow. Der Container ist auf seine verfügbare Breite begrenzt.

## Gestaltung und Bewegung

Breitere Wangen, kleine integrierte Ohren und eine leicht asymmetrische Kontur bilden die Katzen-Silhouette. Indigo/Navy mit heller Konturkante hebt sich vom UI ab. Schmale Cream-Augen, eine kleine Peach-Nase und ein Lavender-Stirnmuster geben Charakter ohne Zubehör oder Orbit-Dekoration. Der Hintergrundschein bleibt schwach.

Idle: sehr kleine Atembewegung über sieben Sekunden, Blinzeln alle neun Sekunden. Focus: keine Atembewegung, nur seltenes Blinzeln über 17 Sekunden. Success: geschlossene freundliche Augen, einmalige Kopfhebung und warmer Akzent über 850 ms. Anschließend bleibt der statische Erfolgsausdruck erhalten.

Eine Änderung von einem anderen State nach `success` startet die Animation. Wiederholtes Rendern mit dauerhaftem `success` startet sie nicht erneut. Für einen neuen Erfolg erst zu Idle/Focus und anschließend wieder zu Success wechseln. Remount oder erneutes Aktivieren von `animated` kann CSS-Animationen neu starten; kein Ereignis-/Belohnungssystem ist daran gekoppelt.

Reduced Motion deaktiviert alle Animationen über CSS. IntersectionObserver pausiert unsichtbare Instanzen; `visibilitychange` pausiert verborgene Tabs. Ohne IntersectionObserver bleibt die Tab-Pause erhalten. Keine JavaScript-Animationsschleife und keine Timer.

## Lokale Preview

Bestehendes `npm run dev` verwenden und die ausgegebene lokale URL mit `?preview=companion` öffnen, typischerweise:

`http://localhost:5173/?preview=companion`

Nur Vite-Dev und Loopback-Hosts sind zugelassen. Die Preview ersetzt für diesen Aufruf ausschließlich den App-Mount, ohne produktive Navigation zu erweitern. Alle sieben Zustände, 60 px, monochrome Silhouette und eine statische 200-px-Ansicht sind enthalten. Success und Level-Up sind zunächst statisch und per Button auslösbar; Zurücksetzen bereitet eine neue Animation vor. „Reduzierte Bewegung simulieren“ stoppt alle Companion-Animationen in der Preview. Die tatsächliche Systempräferenz bleibt unabhängig davon wirksam. Der Link „Zur App“ entfernt den Preview-Zugang. Der Produktionsbuild enthält weder Preview noch die aktuell ausschließlich dort verwendete Companion-Grafik und Styles. Ein gleichlautender Query-Parameter öffnet in Produktion nur die normale App.

## Prüfung und Grenzen

Tests prüfen States, Größen, Accessibility, eindeutige SVG-Referenzen, Animation aus, einmaliges Success-Verhalten, Sichtbarkeit, reine Preview ohne Speicher-/Netzwerkaktionen, Reduced-Motion-CSS und einen echten In-Memory-Produktionsbuild. Die vollständige bestehende Regression-Suite bleibt erhalten.

Eine tatsächliche visuelle Browserprüfung konnte mit dem verfügbaren Computer-Use-Zugriff nicht abgeschlossen werden. Silhouette, Ausdruck, Stirnzeichen bei 60 px und Bewegungswirkung müssen in der lokalen Preview noch visuell abgenommen werden. Automatisierte DOM-/CSS-Tests ersetzen diese gestalterische Prüfung nicht.

Für Phase 12C.3B bleibt die Designabnahme und gegebenenfalls eine gezielte Form-/Kontrastkorrektur offen. Eine Integration in Gamification oder eine Orb-Migration ist nicht Teil dieses Prototyps.

## Phase 12C.3A.1: Visuelle Verfeinerung

Die Augen besitzen weichere, annähernd waagerechte obere Lidverläufe und gerundete Außenwinkel statt scharf abfallender Spitzen. Focus senkt die Lider gleichmäßig etwas ab und verkürzt die Pupillen passend; Idle bleibt offener. Die Cream-Flächen werden nicht vergrößert. Der kleine Mund und die geschlossenen Success-Augen bleiben unverändert.

Die Wangenkontur besitzt rechts einen sanften Übergang mit kleinem Absatz, links eine etwas tiefere Wangenrundung. Kleine integrierte Ohren und dieselbe gemeinsame Silhouette bleiben erhalten. Das Lavender-Stirnmerkmal ist etwas schmaler, dünner und schwächer; gebogene Übergänge ersetzen die geraden Logo-artigen Winkel. Keine neuen Farben oder Effekte.

API, CSS, Animationen einschließlich Success-Dauer und Trigger, Sichtbarkeitspausen, Accessibility, SVG-IDs und der lokale Preview-Zugang sind unverändert. Ein zusätzlicher Test prüft unterschiedliche Idle-/Focus-Geometrie bei identischer Kopfkontur und monochromer Silhouette, ohne feste Koordinaten vorzugeben.

Manuelle Abnahme in `?preview=companion`: Bei 60, 120 und 200 px den freundlichen statt skeptischen Blick, den subtilen Unterschied zwischen Idle und Focus, die natürliche Wirkung des Stirnmerkmals sowie die Katzen-Silhouette ohne Glow prüfen. Besonders bei 60 px bleiben die Wahrnehmbarkeit des Stirnmerkmals und die Pupillenlesbarkeit gestalterische Prüfpunkte. Eine tatsächliche visuelle Browserprüfung wurde für diese Verfeinerung nicht durchgeführt.

## Phase 12C.3A.2: Gezielte visuelle Fehlerkorrektur

Die ursprüngliche Kopfkontur vor 12C.3A.1 ist wiederhergestellt: Die zusätzlichen Wangenabsätze sind entfernt. Beide Innenohren verwenden nun dieselbe Lavender-Farbe und Opacity. Weichere Augen, Idle-/Focus-Unterschied und organisches Stirnmerkmal bleiben erhalten.

Der vermeintliche zusätzliche Success-Mund war kein zweiter Gesichtsausdruck, sondern der animierte, breite Peach-Bogen unter dem eigentlichen Mund. Dieser Bogen ist durch eine radial auslaufende Lichtfläche hinter der deckenden Kopfkontur ersetzt. Dadurch gibt es keine zusätzliche lächelnde Linie und keinen Lichtbogen über dem Gesicht. Der einzelne gemeinsame Mund, geschlossene Success-Augen, Kopfhebung, 850-ms-Dauer und einmaliger Trigger bleiben erhalten. CSS, API und Preview-Zugang sind unverändert.

Regressionstests prüfen die gemeinsame Kontur, identische Innenohrfarben und den einzelnen Mund über wiederholte Zustandswechsel. Der Lichtimpuls muss eine flächige Grafik ohne Konturstrich sein und hinter dem deckenden Kopf liegen. Die bestehenden Trigger-, Reduced-Motion-, Größen-, Accessibility- und SVG-ID-Tests bleiben erhalten. Eine visuelle Browserprüfung wurde nicht durchgeführt; die harmonischen Wangen und der diffuse Success-Impuls sind in der lokalen Preview zusätzlich manuell zu prüfen.
