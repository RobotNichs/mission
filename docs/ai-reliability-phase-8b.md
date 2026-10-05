# KI-Zuverlässigkeit – Phase 8B

Hinweis: [Phase 8B.1](ai-reliability-phase-8b-1.md) aktualisiert die nachfolgend dokumentierte Einzel-Schritt-Themenprüfung zur Planprüfung und erhöht die feste Ausgabegrenze auf 2.048 Tokens. Dieser Text beschreibt den vorherigen Stand.

## Nachgewiesene Schwächen und Grenzen

- Die bisherige Prüfung verglich vollständige Wörter exakt. Eine simulierte Antwort mit „Exponentialfunktion“ wurde für „Exponentialfunktionen lernen“ abgelehnt, obwohl der Bezug ausdrücklich vorhanden ist. Jetzt werden zusätzlich begrenzte vollständige Wortformen berücksichtigt: bei langen Wörtern die Endung `en`, bei Wörtern ab sechs Zeichen die Endung `s`. Keine beliebige Teilwortsuche und keine fachliche Synonymliste.
- Der bisherige Server erfasste nur den ersten Schemafehler. Jetzt liefert `diagnoseAiPlanDraftDetails` maximal acht unterschiedliche Fehlercodes mit dem ersten betroffenen Schritt je Code. `diagnoseAiPlanDraft` behält den bisherigen Einzelcode-Vertrag.
- Der bisherige Fallback verwendete weitgehend generische Titel und gleich lange Blöcke. Jetzt organisiert er konkret die Arbeit mit vorhandenen Unterlagen und Beispielen. Energie beeinflusst Umfangshinweise und Zeitverteilung; Blockaden beeinflussen Einstieg und Arbeitsform. Bei fünf Minuten bleibt eine echte Lernhandlung; Konzentrationsprobleme erhalten bei längeren Budgets Blöcke bis acht Minuten.

Die ursprüngliche Exponentialfunktionen-Ablehnung ist **nicht nachgewiesen**: Es liegt weder der technische Diagnoseeintrag noch eine gefahrlos überprüfbare Antwort vor. Falsche Minutensummen, fehlende Felder, unbekannte Schrittarten, fehlender Textbezug oder eine weitere Rückfrage sind mögliche Ursachen. Eine tatsächliche Häufigkeit oder Erfolgsquote lässt sich aus simulierten Antworten nicht ableiten.

## Diagnose sicher erfassen

Beim nächsten Fehler die in der App angezeigte Diagnose-ID im lokalen Serverterminal suchen. `learning_plan_failure` enthält ID, Kategorie, Laufzeit, ersten `schemaCode` und gegebenenfalls `validationErrors`:

```json
{"schemaCode":"invalid_step_type","field":"kind","stepIndex":0}
```

Indizes sind nullbasiert. Bei fehlendem Themenbezug über mehrere Textfelder wird kein einzelnes Feld als Ursache behauptet; ein ungültiges `topicFocus` kann hingegen als Feld angegeben werden. Doppelte Codes werden zusammengefasst, Folgefehler aus unlesbaren Zeiten/Schrittarten nicht erfunden. Die Liste ist begrenzt und deshalb nicht zwingend vollständig.

Es werden ausschließlich feste Codes, feste Feldnamen und technische Zahlen protokolliert. Keine Lernziele, Rückfrageantworten, Modelltexte, Header, Schlüssel oder abgefangenen Fehlermeldungen. Der Browservertrag bleibt unverändert; die Fehlerliste wird nicht mitgesendet. Terminalausgaben sind nicht dauerhaft gespeichert. Bei Bedarf ausschließlich technische Diagnosezeilen lokal erfassen, keine zusätzlichen Request-/Response-Dumps aktivieren.

Qualitätshinweise erscheinen als separates Ereignis `learning_plan_quality` mit Diagnose-ID und festen `warningCodes`:

- `concrete_start_unclear`: keine erkannte Handlungsformulierung im ersten Beschreibungstext.
- `repeated_step_text`: identischer normalisierter Schritttext.
- `short_step_overload_possible`: mehrere Verknüpfungen in einem Schritt bis fünf Minuten.

Das sind schwache, **nicht blockierende** Heuristiken, keine pädagogische oder semantische Bewertung. Gültige Pläne werden deshalb nicht verworfen. Die bestehende Struktur-, Dauer-, Rückfrage- und Themenprüfung bleibt verbindlich.

## Themenprüfung

`topicFocus`, Titel und Beschreibung werden gemeinsam je Schritt geprüft. Organisatorische Wörter auf Deutsch und Englisch reichen nicht aus. Ein Unterbegriff wie „Mittelwert“ oder „Wachstumsfaktor“ braucht weiterhin einen klaren Textanker zum Ziel oder zur beantworteten Rückfrage in einem der drei Felder. Ein alleiniger Unterbegriff ohne diesen Zusammenhang wird bewusst nicht automatisch zugeordnet.

Die Prüfung kann weder fachliche Richtigkeit noch verdeckte Themenfremdheit sicher erkennen. Auch eine fremde Handlung kann durch einen ausdrücklich eingefügten Zielbegriff die Textprüfung erfüllen. Umgekehrt bleiben unbekannte Synonyme und manche Wortformen unerkannt. Bei ausschließlich allgemeinen Zielen fehlt ein verlässlicher Textanker; eine beantwortete Rückfrage kann ihn liefern. Der lokale Fallback bleibt der sichere Ersatz. Es gibt keine Embeddings, semantischen Zusatzaufrufe oder fachlichen Fakten im Fallback.

## Strukturierte Ausgabe: Empfehlung, keine Umstellung

Stand der Dokumentationsprüfung: 5. Oktober 2026. Groq dokumentiert `response_format.type = "json_schema"` mit `strict: true` für `openai/gpt-oss-20b` und `openai/gpt-oss-120b` am bereits verwendeten Chat-Completions-Endpunkt:

https://console.groq.com/docs/structured-outputs

Eine mögliche spätere Umstellung würde das aktuelle Draft-Objekt als JSON-Schema mit allen Pflichtfeldern, erlaubten Schrittarten und `additionalProperties: false` übertragen. Vor Aktivierung muss das tatsächlich konfigurierte Modell ohne Ausgabe von Geheimnissen auf Unterstützung geprüft und der Requestvertrag mit simulierten Antworten getestet werden. Die Konfiguration der lokalen `.env` wurde hierfür nicht gelesen.

Diese Phase behält Modell, Temperatur `0.2`, Tokenlimit `1400` und `json_object` bei. JSON Object Mode garantiert keine Übereinstimmung mit den Planregeln. Selbst mit JSON-Schema bleiben exakte Minutensumme, Themenbezug, Rückfragezustand und Qualität lokale Aufgaben. Keine Provider-Migration und keine zusätzlichen Abhängigkeiten.

## Spätere Retry-Option, nicht implementiert

Nur nach ausdrücklicher Zustimmung: höchstens ein zusätzlicher Versuch bei transientem Netzwerkfehler, Timeout oder ausgewählten HTTP-Fehlern (z. B. 429/502/503/504), begrenzt durch Gesamtdeadline, Abbruchsignal und gegebenenfalls `Retry-After`. Ein Timeout kann bereits kostenpflichtig verarbeitet worden sein; auch ein einzelner Wiederholungsversuch kann Kosten erhöhen. Keine Wiederholung bei Schema-, Themen-, Minuten- oder Schrittartfehlern, Authentifizierungsfehlern oder ungültigen Eingaben.

## Automatische Prüfung

Die Failure-Matrix verwendet zehn Ziele aus Mathematik, Statistik, Java, SQL, Klausurvorbereitung und Sprachen; 5/20/50/60 Minuten, drei Energielevel und verschiedene Blockaden. Je Ziel werden gültige Unterthemen, Titel-/Beschreibungskontext, Umformulierungen, falsche Summe, unbekannte Schrittart, fehlende/zusätzliche Felder, Überlänge der Schrittzahl, fehlende Lernhandlung, fremde Themen und Rückfragen geprüft. Zusätzlich: Allgemeinwörter, Wortformen, sichere Fehlerdetails, nicht blockierende Qualitätshinweise, Fallback-Verteilung und unveränderte Speicherung. Alle Providerantworten sind simuliert; keine echten Groq-Anfragen.
