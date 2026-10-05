# Reale Groq-Regressionen – Phase 8B.1

## Beleglage

Die gemeldeten realen Diagnosen belegen `topic_reference_missing` an Schritt 3 (Exponentialfunktionen), Schritt 1 (Statistik) und Schritt 0 (Klausur) sowie `model_output_truncated` bei Java. Die frühere Regel verlangte in jedem Schritt einen lexikalischen Zielbegriff. Dadurch waren organisatorische Folgeschritte und Unterbegriffe ohne Wortwiederholung trotz eines passenden Gesamtplans unzulässig.

Die tatsächlichen Modelltexte liegen nicht vor. Die neuen Tests reproduzieren die beschriebenen **Fehlermuster**, nicht die unbekannten Originalantworten. Dass der konkrete abgelehnte Schritt fachlich richtig war, lässt sich aus dem Fehlercode allein nicht beweisen.

Diese Dokumentation aktualisiert die Themenprüfung und Tokenkonfiguration aus [Phase 8B](ai-reliability-phase-8b.md).

## Themenprüfung auf Planebene

Der Provider liefert weiterhin ausschließlich `clarifyingQuestion` und `steps`. Das ausgegebene Plan-Ziel wird serverseitig aus dem validierten Nutzerziel gesetzt; der Frontend-Vertrag prüft weiterhin dessen exakte Gleichheit. Es wird kein neues `goal`-Feld von der KI verlangt.

Bei konkreten Zielen müssen die zusammengeführten `topicFocus`-, Titel- und Beschreibungstexte mindestens einen ausdrücklichen fachlichen Zielbegriff enthalten. Die konservativen Wortvarianten aus Phase 8B bleiben erhalten. Ein Themenanker darf in einem einzigen Schritt stehen, beispielsweise beim Öffnen der Unterlagen. Danach darf der Plan passende Unterthemen, Übungs-, Prüf- und Abschlussaktionen ohne erneute Zielwortnennung enthalten.

Organisatorische Handlungen bilden eine kleine Gruppe: vorhandene Unterlagen/Beispiele/Aufgaben auswählen oder bearbeiten, Ergebnisse prüfen, Notizen/Fragen festhalten, nächste Schritte planen und zusammenfassen. Sie verleihen einem fachlich unverbundenen Gesamtplan **keinen** Themenbezug.

Für allgemeine Klausur-/Prüfungsziele ohne konkretes Fach wird ein Vorbereitungskontext erkannt. Seine Schritte müssen organisatorischen Handlungen entsprechen und mindestens eine Lern-/Übungsaktivität enthalten. Ein explizit genanntes Fach oder eine beantwortete Rückfrage führt wieder zur konkreten Themenprüfung. Klausur-/Prüfungswörter allein ersetzen dann nicht den Fachanker. Ein übersprungener Dialog liefert keinen erfundenen Schwerpunkt.

Eine begrenzte Prüfung erkennt ausdrücklich benannte Themenwechsel, unter anderem Java/Python, SQL, Statistik, Mathematik/Exponentialfunktionen, Biologie/Photosynthese, Französisch, Astronomie, Chemie, Physik und Geschichte. Diese Marker vergeben niemals Gültigkeit, sondern blockieren erkennbare ungefragte Themenwechsel; sie sind **kein vollständiges Fachlexikon**. Eine vergleichende Aufgabe kann dabei konservativ abgelehnt werden, wenn das zusätzliche Gebiet nicht im Nutzerziel steht.

Ohne semantisches Modell sind weder fachliche Wahrheit noch alle erfundenen Fachgebiete erkennbar. Unbekannte Themen, Synonyme und ein bewusst nur als Etikett eingefügter Zielbegriff können die lexikalische Prüfung täuschen. Diese Grenze wird nicht durch eine wachsende vermeintlich vollständige Keyword-Liste kaschiert. Es gibt keine semantischen Zusatzrequests.

`topicFocus` bleibt in jedem Schritt ein nicht leerer String bis 120 Zeichen. Struktur, erlaubte Arten, Textgrenzen, exakte Summe, mindestens eine echte Lernaktivität und maximal eine erlaubte Rückfrage bleiben strikt. Ein fehlender Plan-Themenanker wird als `topic_reference_missing` mit Feld `steps` ohne erfundenen Einzelindex diagnostiziert; erkennbare Themenwechsel behalten ihren Schrittindex. Logs enthalten weiterhin ausschließlich technische Metadaten.

## Java-Truncation und Umfang

Vorheriger Request: `max_tokens: 1400`. Neu: feste Obergrenze `2048` (+648, etwa 46 %). Modell, Temperatur `0.2`, JSON Object Mode und 20-Sekunden-Deadline bleiben unverändert. Kein zusätzlicher Provideraufruf und kein Retry.

Der Prompt empfiehlt:

- 5–10 Minuten: 1–3 Schritte.
- 15–30 Minuten: 2–5 Schritte.
- 35–60 Minuten: 3–6 Schritte.
- Kurze Titel möglichst bis 60, ein Beschreibungssatz möglichst bis 180 und `topicFocus` möglichst bis 60 Zeichen.

Die vorhandene harte Schema-Obergrenze von zwölf Schritten und die bisherigen Textgrenzen bleiben aus Kompatibilitätsgründen erhalten. Die neuen kleineren Werte sind Planungsrichtwerte, keine zusätzlichen Ablehnungsregeln.

Gemessener Systemprompt: **4.618 Zeichen / 4.689 UTF-8-Bytes**. Ein synthetisches sechs-Schritte-JSON an den empfohlenen Textlängen umfasst **2.293 Zeichen**. Zwölf Schritte an den bisherigen Höchstgrenzen erlaubten allein bis zu **9.720 Textzeichen**, noch ohne JSON-Feldnamen. Zeichen und Bytes sind keine Tokens; diese Messungen sind keine Tokenizer- oder Kostenprognose.

Nachgewiesen ist für Java die Kategorie „abgeschnittene Ausgabe“, nicht deren genaue Zusammensetzung. Der Adapter erkennt ausschließlich das Provider-Signal `finish_reason: "length"` und verwirft es vor dem JSON-Parsing, auch wenn der Text zufällig wie vollständiges JSON aussieht. Es liegen keine sicheren realen Nutzungszahlen, Antwortlängen oder Reasoning-Anteile vor. Zu viele/lang beschriebene Schritte und Reasoning-Verbrauch sind mögliche Ursachen. Die kompakte Ausgabe plus 2.048-Tokens-Reserve reduziert das Risiko, garantiert aber keine Vollständigkeit. Mehr tatsächlich erzeugte Tokens können bei späteren echten Anfragen Kosten und Laufzeit erhöhen.

Groq dokumentiert `max_tokens` als bestehenden, zugunsten von `max_completion_tokens` veralteten Parameter. In dieser Phase wird nur sein Wert geändert, nicht der Parametervertrag. GPT-OSS unterstützt Reasoning; dessen Einstellungen bleiben unangetastet:

- [Groq API Reference](https://console.groq.com/docs/api-reference)
- [Groq Reasoning](https://console.groq.com/docs/reasoning)

## Structured Output – bewertete, nicht aktivierte Option

Das vorhandene gemeinsame Schema besteht aus JavaScript-Validierungsfunktionen und TypeScript-Deklarationen, nicht aus einem direkt übertragbaren JSON-Schema. Es kann deshalb nicht unverändert als `json_schema.schema` gesendet werden.

Eine spätere kleine, nach Zustimmung mögliche Änderung würde ausschließlich `response_format` ersetzen:

```js
{ type: 'json_schema', json_schema: {
  name: 'mission_learning_plan', strict: true,
  schema: /* JSON-Schema für das bestehende Draft-Objekt */
} }
```

Das Schema müsste die zwei Draft-Felder sowie die fünf Schritt-Felder als Pflichtfelder deklarieren, Schrittarten enumerieren und zusätzliche Eigenschaften verbieten. Unterstützte Schema-Keywords wären gegen Groqs Dokumentation zu prüfen. Der öffentliche Mission-Vertrag, Anzahl Requests, lokale Speicherung und Abhängigkeiten könnten unverändert bleiben; der Provider-Anfragevertrag würde geändert. Dafür wurde **keine** Zustimmung vorausgesetzt und keine Umstellung vorgenommen.

Groq dokumentiert Strict Structured Outputs für GPT-OSS 20B/120B am bestehenden Chat-Completions-Endpunkt. Schema-konforme Ausgabe kann Formatfehler reduzieren, löst aber weder lexikalischen Themenbezug, exakte Gesamtdauer noch abgeschnittene Generierung vollständig. Diese Prüfungen bleiben lokal nötig.

[Groq Structured Outputs](https://console.groq.com/docs/structured-outputs)

## Tests und geschützte Funktionen

Die Offline-Regressionen prüfen die drei gemeldeten Themenmuster, einen einzigen Plan-Themenanker, Coaching-Handlungen, fremde Gesamtpläne, rein generische Fachpläne, erkannte Themenwechsel, Klausurziele ohne erfundenes Fach, Rückfragen samt Überspringen, exakte Zielbindung und weiterhin strikte Schemafelder.

Die Java-Simulation deklariert einen Testbedarf von 1.700 Completion-Tokens und würde unter 1.400 `length` melden; sie prüft die neue feste Grenze, ist aber keine Messung echter Modellvarianz. Absichtlich gekürzte Antworten bleiben `model_output_truncated`. Bei einer absichtlich fremden Antwort wird weiterhin der konkrete lokale Fallback aus Phase 8B verwendet.

Timer, Fokuszeit, Gamification, Missionsbibliothek, Historie, Onboarding, Fokusmodus und Speicherformate wurden nicht verändert. Alle Modellantworten sind simuliert; keine neuen Abhängigkeiten, echten Groq-Anfragen oder Retries.
