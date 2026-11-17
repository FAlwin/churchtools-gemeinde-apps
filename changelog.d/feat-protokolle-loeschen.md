### Neu (Protokolle)

- **Protokoll löschen.** Die Leitung kann ein Protokoll – Entwurf oder freigegeben – mit „Löschen“ im Kopf der Sitzung
  (neben „Bearbeiten“ und „Teilen / PDF“, in der Ansicht und im Editor) endgültig löschen. Eine Rückfrage nennt Titel,
  Datum und Status und sagt, dass sich das nicht rückgängig machen lässt. Darin wählt man: die **To-Dos aus diesem
  Protokoll** mitlöschen (vorgewählt; sie werden als gelöscht vermerkt und stehen so im Verlauf) oder behalten, und
  **in ChurchTools außerdem** den **Termin** (die Rückfrage nennt, wie viele Eingeladene die Mail „Termin gelöscht“
  bekommen; bei einer Terminserie fällt nur diese Sitzung heraus, ohne Mail) und das **Gruppentreffen** (bei einem
  abgeschlossenen geht die Anwesenheit verloren) – beide Häkchen sind anfangs aus. Danach steht die Liste der Sitzungen
  mit dem Hinweis „Protokoll gelöscht“ da; bleiben Termin und Treffen bestehen, erscheint die Sitzung wieder „ohne
  Protokoll“. Schreibt gerade jemand anderes am Protokoll, wird nichts gelöscht. Scheitert unterwegs ein Schritt,
  bleibt das Fenster offen und sagt, was schon erledigt ist; ein zweiter Versuch macht nichts doppelt. Ein späteres
  Protokoll, das das gelöschte als „Protokoll der letzten Sitzung“ festgehalten hat, zeigt dort „Das damalige Protokoll
  gibt es nicht mehr“.

### Intern (Protokolle)

- „Sitzung absagen“ und „Protokoll löschen“ benutzen jetzt dieselben Bausteine für „Termin absagen“ (`terminAbsagen`,
  auch Serie „nur diese“) und „Gruppentreffen löschen“ (`treffenLoeschen`) – das Verhalten von „Sitzung absagen“ ist
  unverändert. Der Editor kann sein automatisches Speichern anhalten und fortsetzen (`anhalten`/`fortsetzen` an der
  Schreibsteuerung), solange gelöscht wird. `KopfKnopf` hat einen roten Gefahr-Stil.
