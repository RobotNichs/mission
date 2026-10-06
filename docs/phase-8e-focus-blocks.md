# Phase 8E: Lange Sessions und Fokusblöcke

Manuelle und automatische lokale Pläne sowie Vorlagen behalten das vorhandene Maximum von 10.080 Minuten. 90, 120 und 180 Minuten lassen sich im Lernplaneditor einstellen. Die KI-Eingabe bleibt bei 5–60 Minuten; Prompt und API wurden nicht erweitert.

Der Plan hat optional `focusStrategy`: `{mode: 'free'}`, `{mode: 'pomodoro'}` (25/5), `{mode: '50-10'}` oder `{mode: 'custom', focusMinutes, breakMinutes}`. Benutzerdefiniert: ganze Fokusminuten 10–120 und Pausenminuten 1–60. Ohne Strategie gilt Frei. Stoppuhr ignoriert jede Strategie.

Optionaler `focusBlocks`-Zustand im bestehenden Missionsspeicher: Phase `focus`, `break` oder `finished`, Blocknummer, abgeschlossene Blöcke, Phasenrestzeit in Millisekunden und tatsächlich gelaufene Pausenzeit. Die bisherige `remainingSeconds` bleibt die restliche **Fokuszeit**. Die Zeitmessung verwendet weiterhin den vorhandenen monotonen Timer. Nur Fokusphasen rufen die bestehende Vergütung auf; Blockwechsel, Pause und Überspringen vergeben nichts.

Am Fokusende wird die Pause angeboten. Sie startet per Klick. Am Pausenende wartet der nächste Fokusblock ebenfalls auf einen Klick. Überspringen bereitet den nächsten Block vor, startet ihn aber nicht. Überschüssige Zeit eines verspäteten Ticks wird verworfen; sie wird niemals in die nächste Phase übertragen. Die letzte Fokusphase beendet die Session ohne weitere Pause. Pausen können wie Fokusphasen angehalten und Sessions vorzeitig beendet werden.

Reload stellt Phasenrestzeit und Blocknummer angehalten wieder her; es gibt keine gespeicherten laufenden Uhrzeitanker und keine Vergütung für Offline-Zeit. Die unveränderte exklusive Web-Lock-Sicherung schützt auch Pausenaktionen und Blockwechsel. Fehlerhafte optionale Blockdaten werden konservativ neu initialisiert, ohne Fortschritt zu erzeugen. Die bestehenden Speicher-Schlüssel und Versionen bleiben erhalten.

Der Planeditor erlaubt Strategieänderungen. Während laufender Messung ist die bestehende explizite Bestätigung erforderlich; anschließend wird die Zeit finalisiert und angehalten. Neue Strategie oder geänderte Dauer initialisieren einen Fokusblock für die verbleibende Zeit. Reine Text-/Schrittänderungen bei gleicher Dauer und Strategie behalten den Block. Vergütete Fokuszeit wird niemals rückwirkend umgerechnet. Ein Timer-Reset startet wie bisher die volle geplante Zeit neu und bleibt angehalten; bisherige echte Session-Fokuszeit bleibt in Vergütung und Historie erhalten.

Historie ergänzt optional `focusStrategy`, `completedFocusBlocks`, `breakSeconds`. Fokuszeit bleibt primär; Pausen werden separat angezeigt. Nach Strategieänderungen beschreibt das Strategiefeld die zuletzt verwendete Konfiguration; Block-/Pausenwerte zählen tatsächlich absolvierte Abschnitte der gesamten Session, einschließlich früherer Konfigurationen. Alte Einträge bleiben gültig und auf fünf begrenzt. Vorlagen speichern nur die Konfiguration, keine Phase oder Blockfortschritte. Export/Import und alte Vorlagen bleiben kompatibel.

Die Zusammenfassung zeigt Fokuszeit, Blockanzahl und zusätzliche geplante Pausen. Tatsächliche Gesamtdauer kann durch manuelle Startwartezeiten, Unterbrechungen, Überspringen und Resets abweichen. Browser-Tab im Hintergrund bleibt wie beim bestehenden Timer eine laufende Phase, bis deren Grenze erreicht wird; die nächste Phase startet nie automatisch. Geschlossene App zählt nicht weiter. Es gibt keine Benachrichtigungen oder garantierten Hintergrund-Timer-Ticks.

Tests prüfen Zeitgrenzen, Vergütung, lange Pläne, Reload, zwei Tabs, Strategieänderung, Reset, Historie und frische Vorlagen. Visuelle Desktop-/Mobilprüfung wurde nicht durchgeführt. Keine neuen Abhängigkeiten, echten Groq-Anfragen oder Retries.
