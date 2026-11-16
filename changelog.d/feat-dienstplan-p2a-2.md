### Geändert (Dienstplaner)

- **Entwürfe zählen mit – in der Matrix und in „Personen“ gleich.** Ein gültiger (nicht veralteter) Entwurf zählt schon
  wie das, was er bewirken wird: Wer jemanden auf einen freien Platz einträgt, sieht sofort „1 frei“ weniger – im
  Termin-Kopf, im Füllbalken, in der Gruppenzeile und am Handy in der Datumsleiste und im Zettel; in „Personen“ ändern sich
  „Einsätze“ der Person und „Noch offen“. Zurückziehen macht den Platz als frei sichtbar, Ersetzen lässt die Zahl der freien
  Plätze gleich und verschiebt die Einsätze. Veraltete Entwürfe zählen nicht. Beim **Teilen und im PDF** („Wir suchen noch …“,
  Plan als PDF) und bei allem, was an ChurchTools geht, zählt weiter nur, was in ChurchTools steht.
- **In abgesagten Terminen lässt sich nichts mehr eintragen.** In der Matrix ist der freie Platz dort kein Knopf mehr, in
  „Personen“ gibt es in der abgesagten Spalte keinen Zellen-Knopf (kein Rahmen, kein „+“); der Zauberstab ließ sie schon
  aus. Vergangene Termine bleiben eintragbar (Nachtragen). Bestehende Einteilungen bleiben sichtbar.

### Intern (Dienstplaner)

- **Eine Regel „gilt der Platz als frei?“** (`platzGiltFrei`, `zaehleFrei` in `shared/dienstplan/platzNachEntwurf.ts`): aus ihr
  rechnen `terminStand`, `gruppenFrei` und „Noch offen“ in „Personen“; „Einsätze“ rechnen aus `platzPerson` (Fokus).
  **Eine Funktion „Termin nimmt Einträge an“** (`nimmtEintraegeAn`, `plan.ts`) für Matrix, „Personen“, Zauberstab und den
  Regler „Plätze ändern“.
