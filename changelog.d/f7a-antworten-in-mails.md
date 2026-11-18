### Intern

- **Anmeldungen: Antworten in der Bestätigungsmail** (Etappe F, Scheibe F7a; veröffentlicht wird erst nach
  Etappe F). Entwurf `f7-mails-v1`, Klick-Runde 11 und Messung M2 vom 18.11.2026.
  - Fenster „Mails“, Reiter „Bestätigung“: Knöpfe **„Antwort einfügen“** setzen `[Frage]` (Kurzname) an die
    Schreibmarke im eigenen Absatz, dazu `[Vorname]` und `[Anmelde-Nr.]`. ChurchTools ersetzt sie je Person durch die
    Antwort – bei einer freien Antwort mit Text steht ihr Text da (bei Mehrfachauswahl in Klammern dahinter), die
    Adresse kommt aus der Person. Eckige Klammern ohne Frage bleiben Text; das Fenster nennt sie.
  - Schalter **„Alle Angaben mitschicken“**: eine Liste aller Antworten der Person unter dem eigenen Absatz, leere
    fallen weg. Gespeichert als `alle` in der Beschreibung der Routine (ältere ohne das Feld = aus). Die Karte „Mails“
    nennt es („✓ Bestätigung mit … allen Angaben und Link“).
  - Warteliste und Erinnerung bleiben, wie sie sind. Häkchen-Fragen fehlen (nicht gemessen). Fragen zur Anmeldung
    stehen nur in der Mail der ersten Person.
  - Der Platzhalter geht über den **Namen der Spalte** in ChurchTools (er kann vom Text der Frage abweichen, „(2)“).
    Speichern, Abgleich und Vorschau laden Platzhalter und Spalten an einer Stelle (`mailPlatzhalterLaden`); fehlt
    eine Spalte, wird nichts geschrieben und die Meldung nennt die Frage – dieselbe Meldung zeigt jetzt auch die
    Vorschau (`fehltInChurchTools`), statt die Antwort darin still wegzulassen.
  - Neuer Baustein `shared/anmeldung/mailAntworten.ts`; `mailText` ist jetzt dort die eine Stelle für Text in
    Routine-Mails, `PERSON_PLATZHALTER` (Vorname, Nachname) kommt aus `rundmail.ts`.
