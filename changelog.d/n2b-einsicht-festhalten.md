### Intern (Anmeldungen)

- **Nachweise: „Einsicht festhalten“** (Etappe F, Scheibe N2b; veröffentlicht wird erst nach Etappe F). Entwurf `n2-stand-v1`,
  Ansicht 3. Auf der Seite „Nachweise“ öffnet ein Klick auf eine Person (Rechner: Zeile, auch mit Tab und Eingabe; Handy:
  Listenzeile) das Fenster – für Vertrauenspersonen der Art und Admins; eine Art ohne fertige Einstellungen bleibt nur zum Ansehen.
  - **Fenster:** Eingesehen am, Ausgestellt am (Pflicht nur bei Arten „ab Ausstellung“), Ergebnis. Vorbelegt: keine Einsicht
    oder „läuft ab“/„abgelaufen“ → neue Einsicht (heute), sonst die gespeicherten Werte. Fünf Prüftexte, „Festhalten“ bleibt
    gesperrt, solange etwas fehlt. Ein blauer Kasten sagt vorher, was in ChurchTools geschieht („Neue Einsicht“ / „Nur die
    Angaben werden berichtigt“, welche Aufgabe erledigt wird, Rücksprache). Fehler stehen im Fenster, es bleibt offen.
  - **Neue Einsicht oder berichtigen** entscheidet EINE Regel (`aufgabeErledigtDurch`): „Einsicht nehmen“ erledigt jede festgehaltene
    Einsicht (auch eine vor der Anforderung); „Erneut einsehen“ – angelegt am Tag, an dem die vorige Einsicht festgehalten
    wurde – nur eine Einsicht nach diesem Tag, sodass eine Berichtigung (z. B. Rücksprache → keine Eintragung) sie offen
    lässt. Die Regel gilt auch nach Abbruch und Neuladen, weil sie nicht an „anders als vorher“ hängt.
  - **Geschrieben** wird in fester Reihenfolge und jeder Schritt nachgelesen: Gruppenfelder (nach Namen, das Ergebnis als
    Options-Nummer) → Aufgabe erledigen (`doneDate` gesetzt, sonst „nicht übernommen“) → „Erneut einsehen“ auf „Gültig bis“
    verschieben (nach „Einsicht nehmen“ legt der Ablauf sie binnen Sekunden an: bis zu fünfmal kurz nachsehen; nach „Erneut
    einsehen“ erst am nächsten Tag). ChurchTools verschiebt nur auf ein Datum nach heute – ein Gültig bis bis heute wird
    ausgelassen, kein Fehler. Scheitert ein Schritt nach den Feldern, steht im Fenster, was schon gespeichert ist; noch
    einmal „Festhalten“ ist gefahrlos (nichts doppelt, eine schon erledigte Aufgabe wird nicht noch einmal erledigt).
  - **Nachziehen beim Öffnen:** Beim Laden der Seite wird für jede Person mit Einsicht eine offene „Erneut einsehen“, die die
    Einsicht nicht erledigt hat und deren Fälligkeit von „Gültig bis“ abweicht, verschoben – nur verschieben, nie erledigen.
    Fehler dabei stören die Seite nicht (nächstes Öffnen, nächster Versuch).
  - **Demo:** `?demo=vertrauen` speichert die Felder, erledigt und verschiebt Aufgaben (der Ablauf legt „Erneut einsehen“ an).
- Die Adresse einer Person in ChurchTools steht an einer Stelle (`ui/ct/links.ts`, `personLink`) – vorher fünfmal
  ausgeschrieben (Anmeldungen und Organigramm).
