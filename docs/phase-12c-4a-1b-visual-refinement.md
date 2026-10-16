# Phase 12C.4A.1B: Visual Refinement

## Bestandsaufnahme und Ursachen

`#root` besitzt keine eigene Hintergrundregel. `body` hatte aus 4A.1 einen violetten Verlauf mit Ursprung links oben, während die begrenzte `.app-shell` weiterhin das deckende `background-image` aus `index.css` trug. Die spätere Regel änderte nur `background-color`, nicht das Bild. Mobile lässt die Shell 32 px schmaler als den Viewport, Desktop zusätzlich Platz für Sidebar und Außenabstände. Damit waren in den Rändern andere Farben sichtbar als im Inhalt. Diese CSS-Ursache ist nachgewiesen; die konkreten manuellen Screenshots lagen diesem Auftrag nicht als auswertbare Browseransicht vor.

Die ursprünglichen Ambient-Layer saßen auf neun einzelnen Oberflächen, nicht auf der Seite. Negative Z-Ebene mit lokalem `isolation` liegt über dem eigenen Containerhintergrund, aber hinter deckenden Kindflächen; das ist kein genereller Beleg für unsichtbare Pseudo-Elemente. Im Fokusmodus war bereits ein eigener fixer negativer `FocusBackdrop` vorhanden, wodurch die zweite Ambient-Ebene konkurrierte. 3 px Drift, geringe Farbintensität, 36–80-s-Zyklen und deaktivierte sekundäre Mobile-Animationen erklären die geringe Bewegung im bisherigen CSS. Ein statischer Screenshot allein kann deren Wahrnehmbarkeit nicht belegen.

Konkrete Dichtequellen: `.mobile-mission-summary` hatte nebeneinanderstehende Buttons ohne gemeinsame Gap-Regel; der Formularbutton `.clarification-skip` stand direkt vor dem Kontextbereich; Fokus-Controls hatten bereits Umbruch, aber uneinheitliche Zielgrößen der Sekundärbuttons. Große Flächen entstehen aus `.mission-core-panel`, den gemeinsamen `--card-padding`-Werten und der Vielzahl eigenständiger Panel-Komponenten. Keine strukturelle Neuordnung dieser Komponenten in dieser Phase.

## Konsolidierung und Varianten

`ambient.css` ersetzt seine bisherigen Karten-Layer vollständig durch eine fixe Ebene an `.app-shell[data-app-area]`. Der Body ist einheitlich Navy; die Shell ist ausdrücklich transparent, einschließlich des alten Background-Bildes. Der vorhandene aktive Bereich steuert genau eine Atmosphäre, unabhängig von versteckt gemounteten Panels. Kein neuer Navigationsstate, kein DOM-Umbau. Gekaufte Hintergrundthemen beeinflussen weiterhin die Farbvariablen; ihre eigenen deckenden Shell-Hintergründe werden für die gemeinsame Seitengestaltung ersetzt.

| Aktive Ansicht | Gestaltung |
| --- | --- |
| Home | Lavender/Peach und drei schwache Lichtpunkte, mobil ein Punkt |
| Plan ohne Schrittfolge | Ruhiger Randverlauf, ein kleiner Randlichtpunkt |
| Plan mit Schrittfolge | Reduzierte Indigo-Tiefe und schwache statische Linienstruktur |
| Projekte ohne Detail | Ein abstrakter Indigo-Akzent, keine Landschaft |
| Projekte mit Roadmap | Noch schwächerer Indigo-Akzent, keine animierte Roadmap-Linie |
| Bibliothek | Schwacher warmer Randverlauf |
| Fortschritt | Lavender/Indigo hinter den vorhandenen Statistikflächen |
| Collection-Dialog | Ein eigener statischer lokaler Gradient, bestehender Scrollbereich unverändert |
| Fokusmodus | Ausschließlich vorhandener `FocusBackdrop`, keine zusätzliche Ambient-Ebene |

Planformular und Plan sind auf Desktop gleichzeitig vorhanden. Sobald eine Schrittfolge existiert, gilt die ruhigere Detailvariante für die gesamte Planseite. Projekte und Roadmap sind ebenfalls keine getrennten Routen; `:has(.project-detail)` reduziert die Atmosphäre, wenn das tatsächliche Detail existiert. Das sind visuelle Ableitungen aus vorhandenem DOM, keine neue Produktlogik.

## Layering und Bedienung

Ein isolierter Shell-Kontext hält den negativen Layer hinter Inhalt und vor dem einheitlichen Body. Das Pseudo-Element ist viewportgebunden, klickdurchlässig und selbst geclippt; kein Inhaltscontainer erhält eine globale Overflow-Sperre. Sidebar, Bottom-Bar, Safe-Area-Padding, Portale und Fokusrahmen bleiben bei ihren vorhandenen Regeln. Kein neuer positiver Content-Z-Index über Dialogen.

Home-Aktionen verwenden Flex-Wrap mit konsistentem Gap und mindestens 44 px Höhe. Der manuelle Planbutton erhält vertikalen Abstand. Energieoptionen behalten drei Spalten und erhalten platzsparendes Innenpadding sowie umbrechende Hilfstexte. Fokus- und vorhandene Editor-/Projekt-/Bibliotheksaktionen dürfen umbrechen; Bibliotheksaktionen teilen sich mobil verfügbare Zeilen. Keine Handler oder Reihenfolge von Lernschritten geändert. Mission Core bleibt strukturell unverändert.

## Motion und Performance-Grenzen

Eine gemeinsame Transform-/Opacity-Animation bewegt die Ebene 0–8 px bei .65–1 Deckkraft. Desktop-Zyklen: 28–56 Sekunden; mobil 40 Sekunden, weniger Home-Lichtpunkte. Collection bleibt statisch. Keine neuen Filter, Assets, Zufallswerte, Timer, JS-Loops oder neuen Dependencies. Kein pauschales Abschalten der mobilen Atmosphäre. Reduced Motion setzt die Seitenebene statisch; die bestehenden Fokusregeln verantworten weiterhin Still, Pause, Tab-Sichtbarkeit und Reduced Motion.

Die Shell existiert nur außerhalb des immersiven Fokusmodus. Nur ihr aktueller Bereich definiert die aktive Atmosphäre. Keine neue Tab-Sichtbarkeitslogik für die normale App; Browser können Hintergrundanimationen drosseln. Keine Behauptung über FPS, Akku oder gemessene GPU-Last. Compositing der viewportweiten Ebene muss auf einem schwachen Gerät geprüft werden.

## Qualitätssicherung und offene Sichtprüfung

Gezielte CSS-Tests prüfen aktive Varianten, keine unabhängigen Karten-Layer, dekorative Layergrenzen, Body/Shell-Konsistenz, mobile Bewegung, Reduced Motion, bestehende Fokus-Pause-Regeln und konkrete Touch-/Umbruchregeln. Typecheck und Production Build bestanden. Vollständige Testsuite mit zwei Workern und Diff-Prüfung werden im Abschlussbericht ausgewiesen.

Ergebnis: fünf gezielte Tests bestanden; vollständige Suite mit `npm test -- --maxWorkers=2`: 1.175 Tests in 77 Dateien bestanden. `npm run build` einschließlich TypeScript sowie `git diff --check` erfolgreich. Vorhandene Working-Tree-Dateien und der vorherige Stylesheet-Import bleiben erhalten.

Der Computer-Use-Aufruf meldet erneut `apps: []`, `browsers: []`. Keine Browser-Screenshots, Viewportmessungen oder visuelle Freigabe möglich. Die aus CSS entfernte Randursache ist nicht mit einer beobachteten fehlerfreien Browserdarstellung gleichzusetzen. Keine Änderung echter Nutzerdaten zur Sichtprüfung durchgeführt.

Vor manueller Freigabe Home, Plan/Lernplan, Projekte/Roadmap, Fokus, Bibliothek, Fortschritt und Sammlung bei 375/390/430/768/1024 px prüfen. Links/rechts gleiche Grundfarbe, sichtbare ruhige Drift nach einigen Sekunden, ausreichender Kontrast, keine horizontalen Überläufe, sichere Buttons/Dropdowns/Fokusrahmen, Dialogscroll und Bottom-Bar/Safe Areas abnehmen. Fokus-Umgebungen einschließlich Still, Pause und echte System-Reduced-Motion prüfen. Vorhandene Companion-Grafiken, Orbs, Session-/Gamification-/Storage-Logik und PWA bleiben unverändert. Kein Commit oder Push.
