# Phase 12C.4A.1: Visual Foundation & Ambient Backgrounds

## Umfang und Tokens

`src/ambient.css` wird nach dem bisherigen Stylesheet eingebunden. React-Inhalte, Navigation, Layoutbreiten, Abstände, Speicherverträge, Orb-/Companion-Geometrie und Fachlogik bleiben erhalten. Die vorhandene Spacing-Skala (4/8/16/24/32 px) bleibt maßgeblich. Keine neuen Assets oder Abhängigkeiten.

Neue Atmosphärentokens: `--ambient-navy` (#0a1324), Lavender (167/139/216), Peach (233/177/158), Indigo (83/95/158). Vorhandene Tokens für Text, Secondary Text, Border und Kartenfläche erhalten leicht wärmere Navy-/Lavender-Abstufungen. Ausgerüstete bestehende Hintergrundthemen behalten ihre spezifischen Overrides. Sekundärbuttons erhalten erkennbare gedeckte Flächen und zurückhaltende Borders; primäre Aktionen behalten ihren bisherigen Akzent. Keine neue Schrift oder externe Font-Anfrage.

## Varianten auf tatsächlichen Oberflächen

| Oberfläche | Atmosphäre |
| --- | --- |
| Home / Mission Core | Drei kleine Lichtpunkte, Lavender-/Peach-Wash, 42 s |
| Planformular | Warmer Randverlauf und Lavender-Ecke, 36 s |
| Lernplan-Detail | Sehr schwache vertikale Tiefenlinien, 60 s |
| Projekte | Ausschließlich abstrakter Indigo-Verlauf, 54 s |
| Roadmap / Phasenliste | Zurückhaltender diagonaler Gradient, 64 s |
| Fokusmodus | Sehr schwacher Lavender-Wash, 80 s; pausiert mit bestehendem Background-Motion-Status; bei Umgebung „Still“ aus |
| Bibliothek | Schwacher warmer Randverlauf, 58 s; geschlossen statisch |
| Fortschritt / Statistik | Lavender-/Indigo-Wash hinter der Fläche, 48 s |
| Bestehender Collection-Dialog | Gedämpfter Lavender-Verlauf, 56 s |

Keine künstliche Companion-Auswahl oder neue Seite. Die Referenzgrafiken dienen ausschließlich der atmosphärischen Richtung. Ihre Katzen, Landschaften und Navigation wurden nicht übernommen.

## Layering, Motion und mobile Geräte

Gemeinsames Pseudo-Element hinter dem Inhalt, lokaler isolierter Stacking-Kontext, `pointer-events: none`, begrenzte Malfläche und abgerundetes Clipping ausschließlich der Dekoration. Kein Clipping am Inhaltscontainer, keine Änderung von Dialog-/Nav-Z-Indices oder Scrollsperren. Animation verändert nur Opacity (.72–1) und vertikale Translation (0–3 px); keine animierten Filter, Verläufe, Zufallswerte oder JavaScript-Loops.

Verborgene Navigationsbereiche pausieren die Dekoration. Bis 768 px bleiben sekundäre Flächen bewusst statisch, Home/Fokus behalten langsame Bewegung. Reduced Motion schaltet alle neuen Ambient-Bewegungen aus. Vorhandene Fokusumgebungen und ihre Reduced-Motion-Logik bleiben unverändert. Es gibt keine neue Tab-/IntersectionObserver-Logik: sichtbare Dekoration kann in Desktop-Tabs außerhalb des Viewports weiterlaufen; tatsächliche Compositing-/Akkulast muss auf Zielgeräten geprüft werden.

## Prüfung und offene visuelle Abnahme

Gezielte CSS-Vertragstests prüfen vorhandene Oberflächen, Einbindung, Layering, begrenzte Dekoration, fehlende externe Assets/Filter, Hidden-/Still-/Mobile-Regeln und Reduced Motion. TypeScript-/Produktionsbuild und vollständige bestehende Regressionen werden ausgeführt; Laufergebnisse im Abschlussbericht. DOM-/CSS-Verträge beweisen keine visuelle Fehlerfreiheit.

Ergebnis: 1.173 Tests in 77 Dateien bestanden (`npm test -- --maxWorkers=2`), einschließlich drei neuer CSS-Vertragstests. `npm run build` einschließlich `tsc -b` und `git diff --check` erfolgreich. Der erste Build zeigte einen fehlenden Node-Typimport im neuen Test; nach Anpassung an die vorhandene dynamische Importkonvention ohne zusätzliche Abhängigkeit erfolgreich.

Eine Browser-Sichtprüfung und Screenshots konnten nicht durchgeführt werden: Der Computer-Use-Zugriff meldet keine verfügbaren Apps/Browser; das Öffnen des In-App-Browsers scheitert mit „Browser is not available: iab“. Keine Screenshots oder Geräteprüfung werden behauptet.

Manuell vor Freigabe: `npm run dev`, angezeigte lokale URL öffnen; Home, Planformular und Plan, Projekte inklusive offener Roadmap, Bibliothek, Fortschritt und Sammlung bei 375/430/768/1024/1440 px vergleichen. Fehlende Inhalte nur mit lokalen Testdaten erzeugen, keine echten KI-Anfragen erforderlich. Navigation, Formfelder, Accordions und Collection-Schließen anklicken; Tab-Fokus und Dialogscroll prüfen. Fokusmodus mit vorhandener Mission öffnen, Still sowie andere Umgebungen vergleichen, Pause/Exit prüfen. Auf horizontales Scrollen, abgeschnittene Fokusrahmen, Text-/Chartkontrast, Safe Areas und Layer über Controls achten. Reduced Motion über Systemeinstellung oder Browser-Emulation prüfen. Mindestens einen vollständigen langsamen Zyklus beobachten und Performance auf einem schwachen Mobilgerät separat abnehmen. Visuelle Freigabe bleibt offen.
