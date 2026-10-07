# Mission: Deployment-Vorbereitung (Phase 10A)

## Betrieb

Ein Node-fähiges Deployment bedient `dist/` und `/api/*` aus derselben Origin. Root-Deployment `/` wird vorausgesetzt. Keine Accounts, Datenbank oder externe Infrastruktur wurden eingerichtet. Node benötigt mindestens 20.19.0; für ein öffentliches Deployment eine aktuell unterstützte LTS-Version verwenden.

```sh
npm ci
npm test
npm run build
npm start
```

Build benötigt auch devDependencies (Vite/TypeScript); erst nach dem Build dürfen diese entfernt werden. `npm start` startet den vorhandenen Node-Server. `NODE_ENV=production` ausdrücklich in der Hosting-Umgebung setzen; falls es beim direkten Start fehlt, verwendet der Server production. `npm run dev` und `npm run preview` sind Entwicklungs-/Abnahmebefehle, kein Ersatz für den öffentlichen Produktionsserver.

## Environment

| Variable | Bedeutung |
| --- | --- |
| `NODE_ENV` | Für Deployment `production`; Entwicklung unverändert über Vite. |
| `PORT` | Vom Hosting vorgegebener TCP-Port, ganze Zahl 1–65535, Standard 3000. |
| `HOST` | Optionales Interface-Binding; production standardmäßig `0.0.0.0`, Entwicklung `127.0.0.1`. IPv6 z. B. `::` nach Hosting-Vorgabe. |
| `PUBLIC_ORIGIN` | Empfohlen: exakte öffentliche Origin, z. B. `https://mission.example`, ohne Unterpfad/Query/Zugangsdaten. |
| `AI_PROVIDER` | Standard `mock`, kostenlos. `groq` erst bewusst mit serverseitiger Konfiguration aktivieren. |
| `GROQ_API_KEY` | Ausschließlich serverseitiges Secret; niemals `VITE_`, Git oder Frontend. |
| `GROQ_MODEL` | Für Groq erforderlich; vorhandenes Modell beibehalten, keine automatische Auswahl/Änderung. |

`.env` dient weiterhin lokalen serverseitigen Tests; vorhandene Umgebungsvariablen haben Vorrang. Deployment-Secrets im Secret-/Environment-Mechanismus des Hostings verwalten, keine echte `.env` im Artefakt mitliefern. `.env.example` enthält ausschließlich Kommentare/Platzhalter; `.env` und `.env.*` bleiben ignoriert. `AI_PROVIDER=mock` bei kostenfreien Abnahme-/Regressionstests explizit setzen. In Phase 10A wurden keine echten Groq-Anfragen ausgeführt.

## Health und Fehler

`GET /api/health` liefert `{ "status": "ok", "aiConfigured": true|false }`, `Cache-Control: no-store`. Kein Anbieteraufruf, kein Key, Modellname oder interner Pfad. Der Konfigurationsstatus ist keine Provider-Verfügbarkeitsprüfung. Alle anderen unbekannten API-Routen liefern sichere JSON-404. Unerwartete API-Fehler liefern sichere Fehlerkategorie/Diagnose-ID, keine Stacktraces.

## Missbrauchs- und Kostenschutz

Nur `/api/learning-plan` besitzt das In-Memory-Limit:

- 10 Anfragen je Socket-Clientadresse und 60-Sekunden-Fenster.
- 30 Anfragen insgesamt je Serverprozess und 60-Sekunden-Fenster.
- Höchstens vier gleichzeitig verarbeitete Plananfragen; Überlast wird als 429 behandelt.
- Abgelaufene Clientfenster werden entfernt, Tabelle zusätzlich auf 1.000 Adressen begrenzt. Gespeicherte Adressen werden nicht geloggt.
- HTTP 429 mit vorhandener verständlicher Meldung, Diagnose-ID und `Retry-After`. Kein automatischer Retry.

Weiterhin: maximal 16 KiB Body, auch gestreamt geprüft; Content-Length wird vor dem Lesen begrenzt. Komprimierte Eingaben werden nicht angenommen. Lernziel maximal 280 Zeichen, Blockade-/Material-Freitext je 240, Rückfrageantwort 120; unbekannte Felder, falsche Typen und ungültige optionale Kontexte bleiben strikt blockiert. KI-Zeitbudget unverändert 5–60 Minuten. Vorhandener Output-Deckel **2048 Tokens**, Temperatur und Prompt unverändert. Provider-Deadline **20 Sekunden**, einschließlich Antwortverarbeitung. Bei Client-Abbruch wird der laufende Provider-Request abgebrochen; kein weiterer Retry. Ein Abbruch garantiert nicht, dass ein Anbieter bereits angefallene Verarbeitungskosten storniert.

Server: Header-Timeout 10 Sekunden, Request-Empfang 15 Sekunden, Socket-Inaktivität 30 Sekunden, Keep-Alive 5 Sekunden. Ein vorgeschalteter Proxy sollte zusätzliche Verbindungs-, Body- und Timeoutgrenzen erzwingen. Zeitlimits ersetzen keinen DDoS-Schutz.

**Beta-Grenzen:** Limits sind pro Prozess und gehen bei Neustart verloren. Mehrere Instanzen multiplizieren Limits; eine verteilte Sperre ist nicht implementiert. NAT-Nutzer teilen einen Client-Bucket. `X-Forwarded-For`/`Forwarded` werden bewusst nicht vertraut: Hinter einem Proxy können alle Nutzer dessen Socketadresse teilen. Vor skalierter Nutzung ist eine explizite, hostingabhängige Trusted-Proxy-/Edge-Rate-Limit-Konfiguration erforderlich. Ein Angreifer kann weiterhin das gemeinsame Kontingent aufbrauchen. Ohne Anmeldung oder gemeinsames Kostenbudget sind dies keine harte Tages-/Monatsausgabenobergrenze. Vor öffentlicher Groq-Aktivierung Anbieterlimits/Budgetalarme bzw. spätere zentrale Quoten separat festlegen; hier wurde keine Billing-Infrastruktur aktiviert.

## Origin und HTTP-Header

Kein offenes CORS. Produktion lehnt browserseitig als cross-site markierte Anfragen sowie fremde Origin-Header ab. `PUBLIC_ORIGIN` definiert die erlaubte Origin; ohne Angabe wird der Origin-Host mit dem tatsächlichen Host-Header verglichen. Keine ungeprüfte Übernahme von Proxy-Headern. Clients ohne Origin (z. B. curl) bleiben möglich und unterliegen denselben Limits. Origin-Prüfung ist kein Authentifizierungs- oder Bot-Schutz.

Produktionsheader für HTML, Assets, API und Fehler:

- CSP: Skripte, Fetch, Worker, Manifest, Fonts nur `self`; Bilder `self`/`data:`. Keine externen Providerverbindungen aus dem Browser, kein `eval`, kein Inline-JavaScript. Inline-CSS ist für bestehende React-/Orb-Stile erforderlich. SVG-Orbs und JSON-Datei-Downloads bleiben unterstützt.
- `frame-ancestors 'none'`, `X-Frame-Options: DENY`, keine eingebetteten Fremdframes.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Permissions-Policy deaktiviert Kamera, Mikrofon, Geolocation, Payment und USB.

Die Vite-Entwicklungsseite erhält keine Produktions-CSP, damit HMR weiter funktioniert. TLS und HSTS werden beim HTTPS-Hosting/Proxy konfiguriert; der Node-Prozess spricht dahinter HTTP. Kein HSTS auf unverschlüsselten lokalen Testadressen erzwingen. Quellen: [CSP-Dokumentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [Node-HTTP-Timeouts](https://nodejs.org/api/http.html#serverrequesttimeout).

## Statische Dateien, Secrets und Logs

Auslieferung nur für `index.html`, `sw.js`, Manifest und passende Dateien unter `assets/`/`icons/`; Dotfiles, beliebige JSON-Dateien, Sourcemaps, Quell-/Serverdateien und Pfade außerhalb des echten dist-Roots werden nicht ausgeliefert. Symlinks außerhalb des Roots werden abgelehnt. Dateien aus `public` werden nicht pauschal kopiert; der PWA-Build emittiert ausschließlich seine explizite Allowlist.

Der Build-Guard blockiert bekannte `GROQ_API_KEY`-Werte in Clientausgaben, typische Groq-Key-Muster, `.env`-Dateinamen und Secret-artige `VITE_`-Konfiguration. Fehler nennen niemals den gefundenen Wert. Automatische Tests verwenden synthetische Schlüssel und einen echten In-Memory-Produktionsbuild. Dies ist ein zusätzlicher Schutz, kein universeller Secret-Scanner für sämtliche unbekannten Drittanbieter-Schlüssel. Manuelle Prüfung des Deployment-Artefakts und Git-Status bleibt erforderlich.

Standarddiagnosen bleiben eine Whitelist technischer Kategorien, Diagnose-ID, Laufzeit, Schema-Code/Feld/Schrittindex und numerischem Providerstatus. Keine Lernziele, persönlichen Antworten, Kontext-Freitexte, Request-Payloads, Header oder vollständigen Modellantworten. Keine ungefilterten Providerfehler/Stacks. Startup-Logs enthalten ausschließlich neutrale Start-/Konfigurationsmeldungen und Portnummer, keine ENV-Dumps. Proxy-/Hosting-Access-Logs separat datensparsam konfigurieren; Mission kontrolliert diese Logs nicht.

## PWA und Nutzerdaten

HTTPS ist für Geräteinstallation, Service Worker und sichere Web-Locks erforderlich. Alle URLs bleiben same-origin und auf Root-Pfade ausgerichtet. `/api/*`, einschließlich Health, bleibt network-only und no-store. `sw.js`, Manifest und unveränderlich benannte Icons verwenden HTTP-Revalidierung; gehashte Assets langfristigen Cache. Wartende Worker erzwingen keine Aktivierung/Reload während Sessions. Bestehende LocalStorage-Verträge sind unverändert; Cache-Updates löschen keine Nutzerstände. Eine neue öffentliche Origin erhält naturgemäß einen eigenen Browser-Speicher; vorhandene localhost-Spielstände werden nicht automatisch übertragen. Deployment-Anbieter dürfen keine Headers/Cache-Regeln hinzufügen, die API-Antworten oder Worker-Scripts dauerhaft cachen.

## Checkliste

Vor Deployment:

1. `npm test`, `npm run build`, `git diff --check` erfolgreich.
2. Git-/Artefaktprüfung: keine echten `.env`, Secrets oder `VITE_`-Schlüssel. Nur benötigte `dist`, `server`, `shared`, package-Dateien ausliefern.
3. Production-Environment, Port/Binding, `PUBLIC_ORIGIN`, serverseitigen Key und vorhandenes Modell festlegen. Mock für kostenfreie Vorabprüfung.
4. HTTPS, Proxy-Timeouts, datensparsame Access-Logs, Beta-Limits und Anbieterbudget prüfen. Kein Hosting wurde in dieser Phase eingerichtet.

Nach Deployment:

1. Startseite/statische Assets, sichere Headers, JSON-Fehler und `/api/health` prüfen.
2. API zunächst im Mock prüfen; Rate-Limit und `Retry-After` kontrollieren. Erst ausdrücklich autorisiert einen echten Groq-Test durchführen.
3. Manifest, Worker, Installation, Standalone und Offline nach [Phase-9B-Abnahme](phase-9b-pwa.md) prüfen.
4. Mobile Navigation, Fokus-/Pomodoro-Session, pausierten Reload ohne Offline-Vergütung und lokale Daten prüfen.
5. Worker-Update bei offenem Lernfenster prüfen; alte Mission-Caches erst nach vollständigem Schließen ersetzen lassen. Niemals pauschal Site Data löschen.
6. Proxy/NAT-Auswirkung der Clientlimits und Mehrinstanz-Grenzen prüfen. Öffentliche Beta nur innerhalb bewusst akzeptierter Kostengrenzen betreiben.

Echte HTTPS-/Hosting-/Geräteabnahme und providerseitige Budgetprüfung bleiben ausstehend. Keine neue Infrastruktur, npm-Abhängigkeiten, Provider-Retries oder Git-Commits in Phase 10A.
