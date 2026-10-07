# Phase 12B: Visual Polish

Ein begrenzter Dashboard-Styleabschnitt vereinheitlicht Abstände (4, 8, 16, 24 und 32 px), Kartenoberflächen, Rundungen, Typografie und Formularabstände. Die Sidebar wächst auf 208 px; der Desktop-Content nutzt maximal 1280 px mit reserviertem Sidebar-Abstand. Der bestehende Breakpoint 768/769 px bleibt erhalten.

Mission Core gruppiert Daten enger. Auf Mobile begrenzt sein Container den Orb auf 190 px; die bestehende Level-Größenfunktion und die Messung für den Fokusübergang bleiben erhalten. Kisten, Projektphasen, Bibliotheksfilter und Statistik werden kompakter. Aktive Projekte erhalten einen Rahmenmarker. Primäraktionen bleiben Cyan, Nebenaktionen ruhiger; Löschaktionen erhalten ausschließlich eine visuelle Klasse. Deaktivierte Dashboard-Buttons bleiben mit 65 Prozent Deckkraft lesbar.

Keine Änderungen an Navigation, Zuständen, API, Speicherung oder Belohnungen. Fokusmodus und seine Hintergründe werden nicht neu gestaltet. Safe Areas, Fokusregeln, Reduced Motion, Dialoge und bestehende Overflow-Sicherungen bleiben erhalten.

CSS-Verträge prüfen Sidebar-Abstand, mobile Begrenzung, Spacing, aktive Marker und die Abgrenzung zum Fokusmodus. Bestehende Interaktionstests sichern die Funktionen. Tatsächliches Rendering bei 375, 430, 768, 1024, 1440 und 1920 px muss zusätzlich im Browser geprüft werden; CSS-Verträge ersetzen keine visuelle Prüfung.
