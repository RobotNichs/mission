# Phase 12C.3B: Companion States & Motion

Der Companion bleibt vollständig isoliert. Kopfkontur, Innenohrfarben, Stirnmerkmal und Palette bleiben erhalten. Der aktuelle Stand 12C.3B.3 differenziert die statischen Gesichtsausdrücke und ersetzt die frühere Level-Up-Pfadinterpolation. Keine Integration in produktive Screens, Speicherung oder Gamification.

## Zustände

| State | Ausdruck | Bewegung bei `animated` |
| --- | --- | --- |
| `idle` | Offener, symmetrischer Blick | Atmung 7 s, Blinzeln 9 s, kleine Pupillenbewegung 12 s, linkes Innenohrdetail 15 s |
| `focus` | Moderat schmalere symmetrische Augen, kleinere Pupillen und kurzer konzentrierter Mund; kleine Haltung nach unten | Nur seltenes Blinzeln 17 s, keine Atmung oder Blick-/Ohrbewegung |
| `pause` | Offene Augen, Seitenblick und kleines entspanntes Lächeln | Langsamer Seitenblick 20 s und Blinzeln 23 s, keine Atmung |
| `error` | Größere symmetrische Augen mit vollständig sichtbaren Pupillen, kleiner fragender offener Mund | Kurze beidseitige Augenweitung und Kopfneigung bis 5 Grad über 600 ms; ruhige Endhaltung bei 1,5 Grad |
| `offline` | Ruhige, nach unten gerundete geschlossene Lider und kurzer neutraler Mund | Statisch |
| `success` | Freundlich lächelnde geschlossene Augen und ein klarer einzelner Lächelbogen | Einmalige Kopfhebung und Peach-Lichtfläche, 850 ms |
| `levelUp` | Zunächst überraschte offene Augen, kurz Herzpupillen, schließlich stärker lächelnde geschlossene Augen und begeisterter offener Peach-Mund | Einmalige Kopfhebung bis 7 SVG-Einheiten, minimale Skalierung und zeitversetzte diffuse Cream-/Lavender-Lichtfläche, 1.400 ms; unter 80 px ohne Herzen |

Der Lichtimpuls verwendet dieselbe bestehende Fläche hinter dem deckenden Kopf, ohne zusätzliche Konturstriche. Es gibt genau eine äußere Augengruppe und einen aktiven Mund. Level-Up enthält zeitlich gegenseitig ausgeschlossene offene und geschlossene Augen sowie temporäre Herzpupillen. Offline unterscheidet sich durch die ruhige Lidkrümmung, neutralen Mund und fehlende Celebration von Success. Error ersetzt keine sichtbare Fehlermeldung.

## API und Trigger

Die Props bleiben unverändert; nur der `CompanionState`-Uniontyp wird um vier Werte erweitert. Alle Übergänge zwischen den sieben gültigen States sind erlaubt. Es gibt keine neue Session-Zustandsmaschine. Ungültige Namen gehören nicht zum TypeScript-Vertrag; externe Integrationen müssen ungeprüfte Daten vor dem Übergeben auf gültige Zustände abbilden.

Einmalige CSS-Reaktionen starten beim Mount beziehungsweise Eintritt in ihren State. Der vorhandene nach State gekeyte Ausdruck bleibt bei normalen Re-Renders, Größen- oder Labeländerungen bestehen. Ein dauerhaft gesetztes `success`, `levelUp` oder `error` löst daher keine neue Celebration aus. Ein erneuter Eintritt nach einem anderen State startet die Reaktion erneut. Ein Remount oder Deaktivieren und erneutes Aktivieren von `animated` kann die CSS-Animation ebenfalls neu starten; die Preview verwendet Letzteres bewusst für ihre manuellen Trigger.

Falls später mehrere gleichartige Ereignisse ohne State-Wechsel dargestellt werden sollen, wäre ein optionaler expliziter `animationKey` als Teil des visuellen Ausdrucksschlüssels eine kleine mögliche API-Erweiterung. Dieser müsste ausschließlich bei einem neuen Ereignis wechseln, nicht bei jedem Render. In dieser Phase gibt es weder diesen Prop noch eine Event-Architektur.

## Bewegung und Accessibility

`animated={false}` und `silhouette` deaktivieren Animationen. Die bestehende Reduced-Motion-Media-Query deaktiviert sämtliche Bewegungen. IntersectionObserver und Tab-Sichtbarkeit pausieren weiterhin CSS-Animationen, ohne neue JavaScript-Loops oder Timer. Die Wiederherstellung der Sichtbarkeit setzt pausierte Animationen fort, statt den Ausdruck neu zu mounten.

Die dekorative Semantik und das optionale `label` bleiben erhalten; Zustandsänderungen erzeugen keine Live-Region-Ansagen. Bei späterer Integration müssen Fehler, Offline-Status und Fortschritt unabhängig von der Grafik verständlich als Text vermittelt werden.

## Lokale Prüfung

Nach `npm run dev` die angezeigte Loopback-URL mit `?preview=companion` öffnen, üblicherweise `http://localhost:5173/?preview=companion`. Alle sieben Zustände sind direkt bei 120 und 60 px sichtbar. Error und die zwei Celebrations sind per Button auslösbar; anschließend erst zurücksetzen und erneut auslösen. Die zusätzliche kleine 60-px-Vorschau erlaubt weiterhin den Wechsel zwischen allen sieben States. Der Reduced-Motion-Schalter wirkt nur im Runtime-State der Preview. Eine aktivierte Systempräferenz bleibt auch bei ausgeschaltetem Schalter maßgeblich.

Tests prüfen alle States, alle Übergangspaare, gemeinsame Silhouette, einzelne Gesichtselemente, eindeutige SVG-Referenzen über alle Zustände, API-Typen, Animation aus, Re-Render-Stabilität, Sichtbarkeitspausen, Reduced-Motion-Regeln und Preview ohne Storage-/Netzwerkaktionen. Der echte In-Memory-Produktionsbuild wird auf Companion-Preview- und Motion-Code geprüft.

Eine visuelle Browserprüfung wurde nicht durchgeführt. Manuell zu prüfen: Pause bleibt entspannt statt schläfrig; Error wirkt fragend statt genervt; Offline und Success bleiben bei 60 px unterscheidbar; Level-Up wirkt deutlicher, aber nicht hektisch. Außerdem Lichtimpuls und einzelne Munddarstellung während schneller Zustandswechsel sowie Reduced Motion mit realer Systemeinstellung prüfen. Automatisierte DOM-/CSS-Tests ersetzen diese gestalterische Abnahme nicht.

Bei späterer Integration können instabile React-Keys oder wechselndes `animated` Reaktionen erneut starten. Hintergrundpausen verschieben die sichtbare Dauer. Die Grafik hat keine Aussage über einen tatsächlich erreichten Level oder eine Belohnung; diese Daten bleiben ausschließlich Sache der bestehenden Geschäftslogik.

## Phase 12C.3B.2: Persönlichkeit und Motion

Historischer Stand: Die nachfolgende Pfadinterpolation und die ähnlichen Pause-/Error-Lider wurden durch Phase 12C.3B.3 abgelöst.

Ambient Motion bleibt rein CSS-basiert: Idle-Pupillen einschließlich ihrer Highlights bewegen sich gemeinsam um nur wenige SVG-Einheiten. Pause verwendet dieselben offenen Lider, aber einen ruhigeren Seitenblick. Focus hat eine kleine statische Kopfhaltung nach unten und bleibt bis auf seltenes Blinzeln still. Error nutzt dieselbe gespiegelte Lidform für beide Augen statt der früheren einseitigen Absenkung; Augenweitung und Neigung sind einmalig. Offline und Success bleiben unverändert.

Ein echtes artikuliertes Ohrzucken würde das Aufteilen oder Verformen der freigegebenen Außenkontur erfordern. Stattdessen bewegt sich ausschließlich das linke Innenohrdetail sehr leicht um seine untere Mitte. Die Außenkontur und beide Innenohrfarben bleiben identisch; es gibt keine ablösende Ohrgrafik und keine Bewegung des ganzen Kopfs durch diese Animation. Das ist eine bewusste vereinfachte Andeutung, kein vollständig bewegliches Ohr.

Level-Up interpoliert jeweils eine bestehende gefüllte Augenfläche von kurz offen zu geschlossen. Es werden keine zweiten Augen überblendet. Pupillen sind nur in der anfänglichen offenen Phase sichtbar und verschwinden vor dem Schließen. Die Bewegung verwendet CSS-`d` innerhalb einer `@supports`-Abfrage. Ohne Unterstützung dieser CSS-Eigenschaft bleiben die statischen glücklichen Augen mit unsichtbaren Pupillen erhalten; Kopfhebung und Lichtimpuls funktionieren weiterhin. Die kurze Interpolation betrifft nur zwei kleine Augenpfade, nicht die Kopfkontur. Keine Filteranimation, keine neuen Timer und keine JavaScript-Animationsschleife.

Success bleibt bei 850 ms mit warmem Peach-Impuls; Level-Up hebt den Kopf stärker und verlagert seinen Cream-/Lavender-Impuls hinter die kurze Augenöffnungsphase. Der Lichtschein liegt weiterhin hinter dem deckenden Kopf. Ein einzelner gemeinsamer Mundpfad pro Instanz verhindert den früheren Doppelmund-Fehler. State-Key und öffentliche Props bleiben unverändert; normale Re-Renders lösen keine neue Entry-/Celebration-Reaktion aus.

Automatisiert geprüft werden gemeinsame Kopfkontur, gespiegelte Error-/Focus-/Pause-/Idle-Lider, isolierte Pupillen- und Innenohrgruppen, Unterschiede der Ambient-Regeln, einzelne Gesichtselemente, alle Zustandsübergänge, Re-Render-Stabilität, Größen, Accessibility, Sichtbarkeit, Motion-Abschaltung, Preview-Aktionen und Ausschluss aus dem Produktionsbundle. Geänderte Tests verlangen bewusst keine künstlich unterschiedlichen Pause-/Error-Lidformen mehr; die Differenzierung erfolgt über Blick, Haltung und Bewegung.

Nicht visuell geprüft: Natürlichkeit der Pupillenwege, Innenohr-Andeutung, fragender Error-Ausdruck, Ruhe von Focus/Pause und die tatsächliche CSS-Pfadinterpolation bei Level-Up. In der lokalen Preview mindestens 30 Sekunden Idle/Pause beobachten, Error und beide Celebrations mehrfach auslösen, alle States bei 60 px vergleichen sowie Reduced Motion und Tabwechsel prüfen. Die Level-Up-Sequenz ist zusätzlich in den unterstützten Zielbrowsern zu prüfen; CSS-/DOM-Tests sind kein Beleg für fehlerfreies Rendering oder die subjektive Bewegungswirkung.

## Phase 12C.3B.3: Expressive Companion States

Die Referenz „Expressions & Motion“ dient der emotionalen Unterscheidung, ohne ihre zusätzlichen Symbole oder Dekorationen zu übernehmen. Die gemeinsame Kopfkontur, Ohren, Innenohrfarben, das Stirnmerkmal und alle öffentlichen Props bleiben erhalten. Ambient Motion, Sichtbarkeitspausen und der State-Key für einmalige Reaktionen bleiben unverändert.

Idle behält offene Augen und den neutralen Katzenmund. Focus komprimiert ausschließlich die symmetrischen Augenflächen moderat vertikal; seine Pupillen werden passend kleiner, damit sie innerhalb der Augen bleiben. Ein kurzer ruhiger Mund ergänzt den konzentrierten Ausdruck. Pause besitzt offenere Augen und einen eigenen freundlichen Lächelbogen. Error vergrößert beide gespiegelten Augenflächen gleichmäßig und verwendet einen kleinen ovalen fragenden Mund. Offline hat einen neutralen kurzen Mund; Success erhält einen eindeutigen Lächelbogen. Level-Up hat stärker gebogene glückliche Augen und einen offenen Peach-Mund. Jede Instanz rendert nur ihren jeweils aktiven Mundpfad, ohne überblendete Alternativen.

Level-Up läuft einmalig über 1.400 ms. Diskrete CSS-`visibility`-Schritte mit `steps(1, end)` lösen die frühere CSS-`d`-Interpolation ab:

- 0–35 %: offene überraschte Augen mit normalen Pupillen.
- 35–65 %: dieselben offenen Augen mit zwei kleinen Peach-/Lavender-Herzpupillen.
- Ab 65 %: glückliche geschlossene Augen; offene Augen, normale Pupillen und Herzen sind verborgen.
- Kopfhebung und ein einzelner diffuser Lichtimpuls begleiten die Folge; danach bleibt nur der glückliche Endausdruck.

Unter 80 px enthält die Grafik keine Herzdetails und behält während der offenen Phase normale Pupillen. Bei 60 px ist damit ein vereinfachter begeisterter Ausdruck vorhanden. Die Größenentscheidung verwendet den angeforderten `size`-Wert; bei einer nachträglich stark durch den Container verkleinerten größeren Instanz gibt es keine zusätzliche Layoutmessung.

Die offene und die geschlossene Augenphase wechseln am gleichen diskreten Zeitpunkt, ohne Opacity-Crossfade. Auch Pupillen und Herzen wechseln am selben Zeitpunkt gegenseitig. Wichtig bei SVG: `visibility` wird vererbt, kann aber von Kindern überschrieben werden. Deshalb sind offene Augen, normale Pupillen und Herzen im statischen Markup ausdrücklich verborgen, die glücklichen Endaugen sichtbar. Die offene Gruppe erhält zusätzlich eine diskret geschaltete Deckkraft von 0 oder 1: So können neu eingefügte Kinder bei einem Größenwechsel nach Ende der Augenphase nicht durch ihre eigene Sichtbarkeit wieder erscheinen. Ohne Animation und bei Reduced Motion bleibt ausschließlich der statische Endausdruck sichtbar. Alle Übergänge nutzen etablierte CSS-Transforms, Opacity und diskrete Sichtbarkeit; keine Pfadinterpolation, neuen Timer oder JavaScript-Loops.

Automatisierte Tests prüfen sieben unterschiedliche statische Gesichtssignaturen, größere symmetrische Error-Augenflächen gegenüber Idle, kleinere Focus-Augenflächen, gemeinsame Kontur und Farben, einzelne aktive Münder, Herzdetails nur bei ausreichend großem Level-Up, API, Accessibility, SVG-IDs und Sichtbarkeitspausen. Die CSS-Verträge prüfen zusätzlich jede Phasengrenze einschließlich exakt 35 und 65 Prozent auf gegenseitig ausgeschlossene Augen-/Pupillen-/Herzphasen. Die Preview und ihr Produktionsausschluss bleiben abgesichert. Diese Prüfungen sind kein Pixel-Snapshot und kein Beleg für subjektiv überzeugendes Design.

Eine visuelle Browserprüfung wurde nicht durchgeführt. Offen bleibt die manuelle Abnahme aller sieben statischen Gesichter bei 60, 120 und 200 px, der vollständig sichtbaren Error-Pupillen, der Herz-Lesbarkeit und der diskreten Level-Up-Wechsel in den Zielbrowsern. Error und Celebrations wiederholt auslösen, währenddessen den Tab verbergen und zurückkehren sowie echte System-Reduced-Motion und die lokale Simulation prüfen. Prüfen, dass zu keinem Zeitpunkt zwei Münder oder Augenphasen sichtbar sind und keine schwebenden Pupillen zurückbleiben. Kein experimenteller Browser-Fallback mehr erforderlich; tatsächliches Timing und Rendering müssen trotzdem im Browser abgenommen werden.
