# Phase 9B: Installierbare Mission und Offline-Grundlage

## Aufbau

`public/manifest.webmanifest` definiert Mission, Start/Sichtbereich `/`, Deutsch, Standalone und dunkle Start-/Theme-Farben. Keine Orientierungssperre, Benachrichtigungsfähigkeit oder sonstige nicht implementierte Funktionen werden deklariert. Die Oberfläche ist für Portrait gestaltet, bleibt aber drehbar. HTML verlinkt Manifest, SVG-Favicon und Apple-Touch-Icon; `viewport-fit=cover` ermöglicht Safe-Area-Abstände bei weiterhin erlaubtem Zoom.

Lokale PNG-Icons: 192, 512, maskable 512 und Apple 180 px. Das reduzierte `m.`-Motiv liegt in der Maskable-Sicherheitszone; der Hintergrund ist vollständig deckend. SVG-Favicon und PNGs werden mit `node scripts/generate-pwa-icons.mjs` aus derselben Vektorgeometrie reproduzierbar erzeugt. Keine Bild-/Icon-Bibliothek oder externe Assets. Das PNG wurde lokal betrachtet; eine Geräte-/Installationsprüfung wurde nicht durchgeführt.

`server/pwaBuild.mjs` ergänzt den bestehenden Vite-Build. Die Precache-Liste wird aus dem fertigen HTML, JS-/CSS-Bundle und einer expliziten Liste öffentlicher PWA-Dateien erzeugt. Der Cache-Name enthält einen Inhaltsdigest einschließlich Worker-Template und Icons. Es gibt keine manuell gepflegten gehashten Asset-Dateinamen. `dist/sw.js` wird nur für Builds erzeugt. Das vorhandene Projekt setzt Root-Deployment voraus; Subdirectory-Deployment erfordert eine separate Anpassung von API, Manifest, Scope und Pfaden.

## Cache, API und Daten

Der Worker speichert nur die explizit erlaubte statische App-Shell. Installation lädt diese ohne Credentials und mit frischer HTTP-Prüfung. Fehlerhafte/unvollständige Installation verwirft ausschließlich ihren neuen Cache. Statische Treffer werden aus dem aktuellen versionierten Cache geliefert. Online-Navigation zu `/` oder `/index.html` versucht zuerst das Netzwerk; bei Netzwerkfehler/HTTP-Fehler wird die eigene vorab gespeicherte HTML-Shell genutzt. Netzwerk-Navigation überschreibt niemals die versionierte HTML-Kopie. Dadurch bleiben zusammengehörige Offline-Dateien aus einem Build erhalten und ein Vite-Dev-Server wird nicht durch eine alte HTML-Kopie verdeckt.

POST, `/api/*`, Authorization-Header, fremde Origins, unbekannte Pfade und statische Ressourcen mit Query-Parametern werden nicht vom Worker übernommen. Insbesondere gibt es keine gecachten KI-Antworten, Request-Payloads, Diagnosen, Schlüssel oder `.env`-Dateien. Offline schlägt die vorhandene API-Anfrage fehl und ihr bestehender regelbasierter Fallback greift. Keine neue Offline-KI und keine zusätzlichen Requests zum Modellanbieter.

LocalStorage und App-Shell-Cache bleiben getrennt. Installation/Aktivierung verändern keinerlei Missions-, Fortschritts-, Statistik-, Vorlagen- oder Tutorial-Daten. Offline funktionieren die zuvor vorhandenen lokalen Funktionen; Start/Reload stellen Sessions weiterhin pausiert wieder her und vergeben keine Offline-Fokuszeit. Speicherbeschränkungen, Browser-Eviction und Privatmodus können die Offline-Verfügbarkeit verhindern. Ein frischer Besuch ohne vorherige erfolgreiche Installation ist offline nicht möglich.

## Produktion, Entwicklung und Updates

Der Entry ruft `initializePwa` auf. Produktion registriert `/sw.js` nur mit Service-Worker-Unterstützung in einem sicheren Kontext, mit `updateViaCache: none`. Lokaler Test: `localhost`; auf echten Geräten HTTPS verwenden. Der lokale Produktionsserver liefert Manifest/PNG mit passenden MIME-Typen und `sw.js`, Manifest und unveränderlich benannte Icons mit `no-cache`; gehashte Assets behalten ihren langfristigen HTTP-Cache.

Entwicklung registriert keinen Worker. Sie entfernt ausschließlich Mission-eigene `/sw.js`-Registrierungen und `mission-app-shell-*`-Caches, keine fremden Worker/Caches oder lokalen Nutzerdaten. Ein bereits kontrolliertes Fenster verliert seinen Controller erst nach erneutem Öffnen/Reload. Der alte Worker versucht Navigation zuerst online, sodass der Dev-Entry trotzdem geladen und die Bereinigung ausgeführt wird. Bei ungewöhnlichem Altbestand: DevTools → Application → Service Workers → die Mission-Registrierung unregister; anschließend nur Cache Storage `mission-app-shell-*` löschen. **Nicht „Clear site data“ verwenden**, das würde lokale Nutzerstände entfernen.

Neue Worker precachen im Hintergrund und warten regulär. Kein `skipWaiting`, kein `clients.claim`, keine automatische Seitenaktualisierung. Ein dezenter Hinweis zeigt eine wartende Version. Erst wenn alle von der alten Version kontrollierten Mission-Fenster geschlossen wurden, wird die neue Version aktiv und entfernt nur alte Mission-App-Shell-Caches. Ein bloßer Reload bei noch offenen kontrollierten Tabs garantiert keine Aktivierung; das schützt parallele Sessions. Der nächste vollständige App-Start nach dem Schließen verwendet die neue Version.

Ein Offline-Status erscheint dezent im Dashboard und Fokusmodus und verschwindet bei Rückkehr online. `navigator.onLine` ist ein Verbindungshinweis, kein Beweis für Erreichbarkeit des API-Servers. Ein „App installieren“-Button erscheint ausschließlich nach einem echten `beforeinstallprompt`-Event, öffnet nur per Klick den nativen Dialog und verschwindet nach Verwendung/Installation. Keine eigenen Installationsdialoge, User-Agent-Erkennung oder iOS-Installationsversprechen. Browser ohne diese API bleiben normal nutzbar.

## Manuelle Abnahme: Chrome / Edge

1. `npm run build`, anschließend `npm run preview` (oder `npm start`). Für kostenfreien Betrieb ausdrücklich `AI_PROVIDER=mock` verwenden; zur PWA-Abnahme keine echten KI-Anfragen auslösen.
2. Produktions-URL öffnen, DevTools → Application → Manifest: Name, Start-URL, Farben und Icons prüfen. Installierbarkeitsmeldungen prüfen.
3. Application → Service Workers: erfolgreiche Installation/Activation abwarten. Seite einmal neu öffnen bzw. reloaden; prüfen, dass ein Controller aktiv ist.
4. Über die Browser-Installationsaktion oder den angebotenen nativen Button installieren. Homescreen/App-Icon starten: Standalone, Home, bestehende pausierte Mission und eigene Daten prüfen.
5. Bei 390 px (zusätzlich 320/768/1280) Header, Safe Areas, Bottom-Navigation, Sammlung/Editor-Dialoge und Fokusmodus prüfen; Browser-Zoom testen. Fokusmodus zeigt keine Bottom-Bar.
6. DevTools → Network → Offline aktivieren und Seite reloaden. App-Shell, gespeicherte Mission, Bibliothek, Editor, Timer/Stoppuhr/Pomodoro, Orbs, Historie und Statistik prüfen. API niemals aus Cache: vorhandenen Netzwerkfehler/Fallback prüfen, ohne einen echten Provider zu verwenden.
7. App schließen, Zeit verstreichen lassen und offline neu öffnen: Timer pausiert, keine zusätzliche Fokuszeit oder Coins. Wieder online gehen: Status verschwindet.
8. Eine kleine visuelle Änderung neu bauen, Produktionsserver bedienen und ein offenes App-Fenster behalten. Worker-Update über DevTools „Update“ prüfen (nicht „Update on reload“/„Skip waiting“ erzwingen). Wartenden Worker und Hinweis prüfen; laufende Session wird nicht neu geladen.
9. Alle Mission-Fenster schließen und erneut öffnen: neuer Worker/Cache aktiv, alte Mission-Caches entfernt, lokale Daten vollständig vorhanden. Kein „Clear site data“ benutzen.
10. `npm run dev` öffnen: keine neue Worker-Registrierung, Mission-eigener Altbestand bereinigt, HMR funktioniert.

## iOS: realistisch prüfbare Schritte

HTTPS-URL in Safari öffnen und einmal erfolgreich laden. Teilen → „Zum Home-Bildschirm“ verwenden, soweit das Gerät diese Aktion anbietet. Über das Icon starten, Safe Areas/Bottom-Navigation/Fokusdialoge prüfen. Nach erfolgreicher Worker-Installation im Flugmodus erneut öffnen und lokale Funktionen prüfen. Netzwerk wieder aktivieren; für Updates alle App-Fenster schließen und neu öffnen. Die Installation erfolgt über Safari, nicht über einen versprochenen programmatischen Prompt. OS-Version und Speicherpolitik können sich unterscheiden; keine echte iOS-/Geräteprüfung wurde durchgeführt.

## Automatische Prüfungen und Grenzen

Tests verwenden simulierte Service-Worker-Events, Cache-/Netzwerkobjekte und native Installations-Events. Ein echter Vite-In-Memory-Produktionsbuild prüft die generierten Dateien und gehashten Precache-Einträge. Tests prüfen API-/Daten-Ausschluss, Cache-Aktivierung/Installationsfehler, Offline-Shell, Dev-Bereinigung, Status/Installation/Updates und mobile Offline-Restore-Sicherheit. CSS-Verträge ersetzen keine echte Browser-/Standalone-Geometrieprüfung. Browser-Installierbarkeit und Geräteverhalten müssen mit obigen Schritten noch abgenommen werden.

Referenz: [MDN – Service Worker Lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [MDN – PWA-Installierbarkeit](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
