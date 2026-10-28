### Intern (Protokolle)

- **Wackelnder Test behoben:** Die Tests der Suche (`Suche.test.tsx`) warteten nur auf die Überschrift („Treffer“,
  „Alle Beschlüsse“) und prüften dann sofort die Liste. Die Überschrift steht aber schon über „Wird geladen …“ – unter
  der Last der Gesamtsuite war die Liste am 28.10.2026 noch leer. Jetzt warten sie, bis das Laden fertig ist.
  Gegenprobe: Mit 50 ms Ladezeit fielen vorher 7 von 11 Tests, jetzt keiner. Für Nutzer kein Fehler – während des
  Ladens steht unter der Überschrift „Wird geladen …“, keine leere Liste.
