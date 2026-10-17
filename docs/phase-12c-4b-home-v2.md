# Phase 12C.4B: Home V2

## Inventar vorher / erhaltene Funktionen

Home zeigte Missionsziel, laufend/pausiert/bereit, Plan- und Projektlinks sowie aktiven Projekthinweis. Hinzu kamen Timer mit Fokusstrategie-/Blockzusammenfassung, Phasenrestzeit, Umgebungswahl und Hinweis, Start/Pause/Fortsetzen, Reset, Pause überspringen, Session beenden bzw. Stoppuhr abschließen. Mission Core enthielt echten Level, Fokuszeit, Coins, Prestige, nächsten Level und Reward-Hinweis einschließlich Dev-Level-Vorschau. Kisten/Collection einschließlich Equip und Prestige-Orbs blieben eigene Systeme. Header, lokaler Speicher-/Writer-Hinweis, Tour-Angebot/Spotlight, Hilfe/Info/Datenschutz/Backup, PWA-Status, Review-/Abschlussdialoge und Footer sind ebenfalls erhalten.

## Neue Struktur

Die read-only `HomeMission` zeigt zuerst das vollständige vorhandene Ziel neben einem vorhandenen MissionCompanion. Darunter stehen Sessionstatus, geplante Fokuszeit (Stoppuhr ausdrücklich frei), tatsächlicher Schrittzähler und nächster offener Schritt. Projektzugehörigkeit kommt nur aus `sourceProject`; der schon vorhandene aktive Projekthinweis bleibt separat erhalten.

Die Hauptaktion delegiert an vorhandene App-Funktionen: keine Mission öffnet Plan, vorbereitet startet `toggleTimer`, pausiert setzt derselbe Handler fort, laufend öffnet `openMobileFocus` die vorhandene Fokusansicht. Bei Countdown-Ende bleibt die bisherige Weiter-/Neustart-Semantik des Timers maßgeblich. Geplante Pause wird ausdrücklich als Pause benannt; keine neue Zeitlogik. Der vollständige Timer bleibt als kompakterer Bedienbereich erhalten. Fortschritt folgt darunter, mit kleinem weiterhin echtem Orb, unveränderter Berechnung und kompakteren Kennzahlen. Kisten und Sammlung folgen nachrangig, bleiben direkt erreichbar.

`home.css` ist auf Home begrenzt und folgt nach der unveränderten Ambient-Foundation. Andere Hauptseiten und FocusMode-Layout bleiben unverändert. Lange Ziele umbrechen vollständig; vorhandene Navigations-, Fokus-/Safe-Area-Regeln bleiben maßgeblich. Der Companion wird nicht geclippt und bleibt dekorativ; Text vermittelt Status und Aktionen unabhängig vom Bild.

## Präferenz und Legacy

`HomeMission` liest die Präferenz einmal beim Mount über den vorhandenen Service. Fehlend/ungültig/nicht lesbar ergibt Luna, ohne Schreiben oder Reparatur. Zugriffsfehler erhalten einen knappen Hinweis. Explizite Luna/Milo/Nova werden ausschließlich angezeigt; kein Auswahl- oder Speicher-UI. Während Home ausgeblendet ist, ist die Companion-Animation deaktiviert. Bestehende Reduced Motion und Sichtbarkeitspausen bleiben in der unveränderten SVG-Komponente.

Die Präferenz ist ein Mount-Snapshot: externe Änderungen in einem anderen Tab werden erst beim nächsten Mount/Reload sichtbar; es gibt in dieser Phase keine neue Synchronisationsarchitektur. Keine Kopplung an Orb-Besitz. Der kleine Legacy-Orb samt Dashboard-Ref bleibt für vorhandene Fokus-Transition und Equip erhalten. Kein Mapping, kein Ausrüstungs-/Coin-/Prestige-Schreiben durch Home. Bestehende App-Hydrierung darf wie bisher normalisierte Daten schreiben; die neue read-only Präsentation fügt keine Schreiboperation hinzu.

## Prüfungen und manuelle Abnahme

Komponententests prüfen kostenlose Skin-Anzeige, Fallbacks, Zugriffsausfall, keine Schreiboperation, unveränderte Inputs, Navigation und explizite Delegation ohne Render-Start. App-Integration prüft pausierte Restzeit, Session-ID und Fokuszeit, vorhandenes Guthaben/Besitz/Kaufjournal, echten Resume und Collection. Simulierte Media-Queries prüfen Navigationsverträge bei 375/390/430/768/1024 px, keine echten Pixel-Layouts. Der Produktionsbundle-Test erlaubt jetzt den genehmigten Renderer und Motion-Code, verlangt weiterhin fehlende Dev-Preview und Dev-Werkzeuge.

Der Computer-Use-Zugriff meldet keine Apps/Browser. Keine echten Screenshots oder Browserprüfung möglich. Offen: visuelle Hierarchie und Höhe auf Smartphones, lange Ziele und dynamische Schriftgrößen, vollständige Ohren/Glow, Timer-Controls, Companion und Legacy-Transition, Kontrast, horizontaler Overflow, Tastatur-/Dialogfokus und echte Reduced Motion. Keine FPS-/Performancebehauptung. Testergebnisse werden im Abschlussbericht dokumentiert. Keine Änderung an Companion-Geometrie, Timer-, Belohnungs-, Storage-, Backup-, KI- oder PWA-Verträgen. Kein Commit und kein Push.

Ergebnis: 14 Home-Komponententests und acht neue App-Integrationstests bestanden. Die gezielte Prüfung mit den bestehenden Plan-/Projektmissionstests bestand mit 33 Tests. Vollständiger Abschlusslauf: 1.197 Tests in 79 Dateien mit maximal zwei Workern bestanden. TypeScript/Production Build und `git diff --check` erfolgreich. Im ersten Gesamtlauf waren drei Text-Queries durch die neue Home-Zusammenfassung mehrdeutig; die bestehenden Tests sind jetzt auf Planbereich bzw. Schritt-Checkbox eingegrenzt, ihre fachlichen Daten-/Reward-Assertions bleiben erhalten. Der Produktionsbuild prüft weiterhin den Ausschluss der lokalen Preview und aller Dev-Steuerungen.

## Phase 12C.4B.1: Hero-Verfeinerung

Die Intro-Zone ist jetzt vertikal und zentriert: vollständiger Missionstitel, darunter derselbe vorhandene Companion mit angeforderten 200 px statt 120 px. Keine Änderung an SVG, Skin oder Ausdruck. Eine wiederverwendbar benannte `companion-hero-stage` ergänzt rein dekorativ einen kleinen radialen Glow, zwei feine statische Ellipsen und drei Lichtpunkte. Die kleine Punktefläche driftet CSS-basiert um insgesamt 5 px über 14 Sekunden; kein Filter, kein Asset, kein Timer oder JavaScript-Loop. `aria-hidden`, `pointer-events: none` und eine isolierte hintere Ebene halten die Dekoration außerhalb von Interaktion und Screenreader-Inhalt. Reduced Motion deaktiviert sie; ausgeblendetes Home und laufender Fokus pausieren ihre Bewegung. Die bestehende Ambient-Foundation ist unverändert.

Metadaten verwenden jetzt „50 Min geplant · 1/2 Schritte“, der nächste Schritt bleibt vollständig als kompakte Inline-Zeile erhalten. Status bleibt inhaltlich unverändert und wird als kleiner Chip präsentiert. Projekt-/Aktivprojekthinweis und Storage-Fehler bleiben erhalten. Nur der unverbindliche Leerzustandstext wurde gekürzt. Hauptaktion und Callbacks sind unverändert; die primäre Aktion erhält eine zentrierte Maximalbreite, Sekundäraktionen transparentere Flächen bei weiterhin mindestens 44 px Touchhöhe. Der vorhandene Timer tritt durch transparente Fläche und sekundär gestalteten Startbutton zurück, ohne Controls zu entfernen. Die kompakte Fortschrittssektion bleibt unverändert.

Keine neue Auswahl oder Präferenzspeicherung; die bestehenden read-only Tests gelten weiterhin. Zusätzliche Tests prüfen rein dekorative, nicht fokussierbare Bühne, keine neuen Controls oder Writes bei Re-Render sowie CSS-Pause und Reduced Motion. Der Test auf die ausgeschriebene alte Metazeile ist auf die ausdrücklich gewünschte kompakte Präsentation angepasst; dieselben echten Werte bleiben geprüft.

Auch für diese Verfeinerung meldet der Computer-Use-Zugriff keine Apps/Browser. Keine echte visuelle Abnahme oder Screenshots möglich. Manuell zu prüfen: Zentralität/Größe und vollständige Ohren/Glow bei 375–430 px, volle lange Titel und Schritte, ruhige Ring-/Punktwirkung, CTA-Hierarchie, Tab-Fokus, Schriftvergrößerung, Reduced Motion und ausreichender Abstand zur unveränderten Bottom-Navigation. Die Bühne ist nur auf Home eingebunden; kein Umbau des Fokusmodus.

Prüfung 4B.1: Gesamtsuite mit 1.199 Tests in 79 Dateien bei maximal zwei Workern bestanden. Die gezielte Home-Suite bestand vor den zwei zusätzlichen Dekorations-/CSS-Tests mit 23 Tests; beide Ergänzungen sind im Gesamtlauf grün. Typecheck/Produktionsbuild und Diff-Check erfolgreich.
