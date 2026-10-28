### Geändert (Musik-App, Abwesenheiten wie im Dienstplaner)

- **Zeitraum statt Monats-Kapseln:** Oben steht jetzt derselbe Zeitraum-Knopf wie in Dienstplaner › Planen – ab heute
  (die nächsten vier Wochen), dieser Monat, nächster Monat oder ein eigener Zeitraum von–bis, höchstens ein Jahr
  voraus. Die Termine stehen nach Monaten überschrieben darunter.
- **Filter mit Häkchen:** Statt der Kapseln „Alle · Gottesdienst · …“ gibt es den Knopf „Filter“ wie im Dienstplaner.
  Je Termin-Art ein Häkchen; man kann jetzt auch mehrere Arten ausblenden. Die Zahl am Knopf zeigt, wie viele gerade
  ausgeblendet sind. Eine bisher gemerkte Wahl („nur Gottesdienst“) wird übernommen.

### Intern

- `ZeitraumKnopf`, `FilterKnopf` und `useAufklapp` liegen jetzt in `ui/bedienung` (vorher im Dienstplaner), die
  Zeitraum-Regel in `shared/ct/zeitraum.ts`; das „+ … hinzufügen“-Menü aus S2 nutzt denselben Aufklapp-Baustein statt
  einer eigenen Kopie. Die Jahresgrenze für Termine (`MAX_VORAUS_TAGE`) steht in `shared/absences` für Server und App.
