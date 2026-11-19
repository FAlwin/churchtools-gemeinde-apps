### Neu (Dienstplaner)

- **„Wer kann?“ zeigt die Antworten aus „Wann kann ich?“.** Die Liste ist in Abschnitte geteilt: **Hat Ja gesagt**, **Vielleicht**,
  **Keine Antwort** – jeweils mit der Zahl – und darunter eingeklappt **Kann nicht / abwesend** (aufklappbar, die Personen dort bleiben
  wählbar). Innerhalb eines Abschnitts bleibt die Reihenfolge „frei und selten dran“. Die **Notiz** der Antwort steht kursiv als zweite
  Zeile („Vielleicht: „nur bis 12 Uhr““). Wer in ChurchTools abwesend ist (auch mit Ja) oder **nur für andere Dienste** geantwortet
  hat („Ja – nur für Gesang“), steht unter „Kann nicht / abwesend“. Unten der Hinweis: Die Antwort ersetzt nicht die Prüfung von
  ChurchTools – Warnungen bleiben rot, ein Klick trägt trotzdem ein. Die Suche filtert über alle Abschnitte.
- **Der Zauberstab bevorzugt Ja.** Er nimmt zuerst, wer Ja gesagt hat, dann Vielleicht, dann Personen ohne Antwort – innerhalb davon wie
  bisher nach ChurchTools-Punkten, Einsätzen im Lauf und Namen. Die Grenze von −100 Punkten bleibt (auch ein Ja darunter wird nicht
  genommen); wer nur für andere Dienste geantwortet hat, wird für diesen Dienst nicht genommen. Im Fenster steht die Antwort hinter
  dem Namen („Ben (0×) – Ja“).
- **Sicher, wenn die Antworten fehlen.** Sind sie nicht sichtbar (Speicher nicht eingerichtet, kein Recht, Dienstgruppe nicht planbar),
  sehen „Wer kann?“ und der Zauberstab aus wie bisher. Gelingt das Laden nur vorübergehend nicht, steht die bisherige Liste da mit dem
  Hinweis „Antworten aus „Wann kann ich?“ gerade nicht geladen“ – niemand wird dann als „Keine Antwort“ einsortiert.

### Geändert (Dienstplaner)

- Raster, „Wer kann?“ und Zauberstab ordnen eine Antwort mit **derselben Regel** ein (`antwortFuer`/`antwortStufe` in
  `shared/dienstplan/personenAntworten.ts`).
