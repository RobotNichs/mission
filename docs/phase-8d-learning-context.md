# Phase 8D: Optionaler Lernkontext

`learningContext` ist ein optionales Feld in Formularentwurf, Lernplan, API-Request/-Antwort und Mission-Vorlage. Es enthält ausschließlich:

- `environment`: `school`, `university`, `training`, `work`, `private`, `other`.
- `purpose`: `exam`, `homework`, `project`, `revision`, `new-topic`, `interest`, `other`.
- `materials`: eindeutige Auswahl aus `slides`, `script`, `book`, `worksheets`, `notes`, `online`, `tasks`, `none`, `other`.
- `materialsDetails`: optionaler einfacher Text bis 240 Zeichen, nur bei `other`.

Fehlendes Feld bzw. leere Materialauswahl bedeutet unbekannte Materialien. `none` ist eine ausdrücklich leere Ausstattung und lässt sich nicht mit anderen Materialien kombinieren. Keine Angabe bei Umgebung/Zweck wird durch das fehlende Feld ausgedrückt.

## Kompatibilität und Speicherung

Die Schlüssel und Versionen für Mission, Fortschritt und Vorlagen bleiben erhalten. Alte Requests und Vorlagen ohne Kontext sind gültig. Fehlerhafter optionaler Kontext wird beim Laden einer Mission verworfen, ohne Mission, IDs, Schritte oder Timer zu verwerfen. API-Eingaben und importierte Vorlagen mit ungültigem Kontext werden abgelehnt. Materialarrays werden beim Übernehmen kopiert.

Formular-Kontext ändert die aktive Mission erst beim ausdrücklich angeforderten Planwechsel. Der Planeditor kann Kontext für aktive Pläne und Vorlagen ändern. Seine bestehenden Bestätigungen laufender Sessions bleiben maßgeblich. Vorlagen enthalten Kontext, aber keine Rückfragen, erledigten Schritte oder Fortschrittsdaten. Exportierter Material-Freitext ist Teil der bewusst geteilten Vorlage.

## Planung und Diagnose

Der Groq-Prompt behandelt Kontext als Nutzerdaten und verbietet institutionelle Materialannahmen. Der Mock und lokale Fallback verwenden gemeinsame Kontext-Hilfen. Bei `none` organisieren sie eigene Fragen, Abruf und kleine eigene Ansätze. Zweck und Blockade beeinflussen Handlungen; Beruf kann eine kleine praktische Anwendung vorschlagen, ohne vertrauliche Daten anzufordern.

Eine Materialrückfrage ist im Mock nur bei materialabhängigem Ziel und fehlender Materialangabe vorgesehen. Groq entscheidet im Rahmen des Prompts, ob eine wesentliche Angabe fehlt. Die bestehende Begrenzung auf eine Rückfrage, Überspringen und ein vorläufiger Plan bleiben erhalten. Eine Materialantwort verändert Ressourcen, nicht das Fachziel.

`material_reference_unavailable` erkennt begrenzt direkte Anweisungen mit unbelegt benannten Ressourcen (z. B. Buch, Skript, Musterlösung). Bei `none` werden auch direkte Aufforderungen zum Öffnen vorhandener Unterlagen blockiert. Bedingte Vorschläge mit „falls vorhanden“ sind erlaubt. Serverdiagnosen enthalten nur Code, technischen Feldnamen und Schrittindex; weder Kontext noch Modelltexte werden protokolliert. Der Client prüft ebenfalls Materialannahmen und übernimmt Kontext nur bei Übereinstimmung mit dem Request.

Die Ressourcenprüfung ist konservativ und regelbasiert. Sie ist keine vollständige semantische Prüfung: unbekannte Umschreibungen können unerkannt bleiben, ungewöhnliche Formulierungen können zum Fallback führen. Persönliche Freitexte werden bei echter KI-Planung an den konfigurierten Anbieter übertragen; darauf weist das Kontextformular hin. Es wurden keine echten Provider-Anfragen ausgeführt und keine Retries hinzugefügt.

Automatisierte Tests prüfen Kontextvarianten, Materialannahmen, Rückfragen, Datenschutzdiagnosen, alte Verträge, Fallback, Editor, Reload und Vorlagen sowie unveränderte Fortschrittsdaten. Eine visuelle Browserprüfung ist separat erforderlich.
