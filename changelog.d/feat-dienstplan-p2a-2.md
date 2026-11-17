### Geändert (Dienstplaner)

- **Entwürfe zählen mit – in der Matrix und in „Personen“ gleich.** Ein gültiger (nicht veralteter) Entwurf zählt schon
  wie das, was er bewirken wird: Wer jemanden auf einen freien Platz einträgt, sieht sofort „1 frei“ weniger – im
  Termin-Kopf, im Füllbalken, in der Gruppenzeile und am Handy in der Datumsleiste und im Zettel; in „Personen“ ändern sich
  „Einsätze“ der Person und „Noch offen“. Zurückziehen macht den Platz als frei sichtbar, Ersetzen lässt die Zahl der freien
  Plätze gleich und verschiebt die Einsätze. Veraltete Entwürfe zählen nicht. Beim **Teilen und im PDF** („Wir suchen noch …“,
  Plan als PDF) und bei allem, was an ChurchTools geht, zählt weiter nur, was in ChurchTools steht.
- **In abgesagten Terminen lässt sich nichts mehr eintragen.** In der Matrix ist der freie Platz dort kein Knopf mehr, in
  „Personen“ gibt es in der abgesagten Spalte keinen Eintragen-Knopf (kein Rahmen, kein „+“); der Zauberstab ließ sie schon
  aus. Den eigenen Entwurf nimmt ein Klick dort weiter weg, wie in der Matrix. Vergangene Termine bleiben eintragbar
  (Nachtragen). Bestehende Einteilungen bleiben sichtbar.
- **Personen: „Platz übernehmen“ statt „Dienst voll“.** Ist ein Dienst nur noch durch einen „Zurückziehen“-Entwurf frei,
  ersetzt ein Klick in die Zelle diesen Entwurf: aus „X zurückziehen“ wird „X durch Y ersetzen“ – derselbe Weg wie
  „Andere Person wählen“ in der Matrix, mit Schutz gegen gleichzeitige Änderungen. Ein freier Platz ohne Entwurf hat Vorrang.
  Nimmt man Y wieder weg, steht dort wieder X wie in ChurchTools.

### Intern (Dienstplaner)

- **Eine Regel „gilt der Platz als frei?“** (`platzGiltFrei`, `zaehleFrei` in `shared/dienstplan/platzNachEntwurf.ts`): aus ihr
  rechnen `terminStand`, `gruppenFrei` und „Noch offen“ in „Personen“; „Einsätze“ rechnen aus `platzPerson` (Fokus).
  `platzFuerEintrag` (`personenEintragen.ts`) ist die eine Regel, welcher Platz für einen neuen Entwurf zu haben ist.
  **Eine Funktion „Termin nimmt Einträge an“** (`nimmtEintraegeAn`, `plan.ts`) für Matrix, „Personen“, Zauberstab und den
  Regler „Plätze ändern“.
