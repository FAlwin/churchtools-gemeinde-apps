### Intern

- **Anmeldungen: Bedingungen wirken im Formular** (Etappe F, Scheibe F1b; einstellen lassen sie sich erst mit F1c).
  Das öffentliche Formular, die Vorschau und die Anmeldung von Hand wenden die Bedingungen aus
  `shared/anmeldung/bedingungen.ts` an – über EINE Stelle, `ui/anmeldeformular/useBedingungen.ts`.
  - Fragen mit Bedingung erscheinen erst, wenn sie zutrifft – beim Kontakt und je Person einzeln. Pflicht gilt nur,
    solange die Frage zu sehen ist.
  - Antworten mit Bedingung sind ausgegraut mit Grund („Gruppenleiter (nur für Getaufte)“) oder fehlen ganz – bei
    Ja/Nein, Auswahl, Auswahlliste und Mehrfachauswahl.
  - Wird eine gewählte Antwort ungültig, wird die Wahl sofort gelöst, und die Frage sagt warum („… ist nur für Getaufte
    möglich – bitte neu wählen.“). Der Hinweis bleibt, bis man an dieser Frage neu wählt.
  - Eine ausgeblendete Frage behält ihren Wert, solange man ausfüllt. Nach ChurchTools kommt sie nicht:
    `anmeldungAufbauen` leert vor dem Senden (`leeren`). Weil das Formular und „Von Hand“ beide durch diese Stelle
    gehen, gilt das für beide.
  - Der Betrag rechnet mit einem ausgeblendeten Geburtsdatum nicht (`buchungAus`) – angezeigt wie gespeichert.
  - Im Baukasten bleibt alles sichtbar und wählbar.
  - Neu im Regel-Baustein: `loesen` (nur ungültige Wahl lösen, `leeren` baut darauf auf) und `antwortZustand`.
