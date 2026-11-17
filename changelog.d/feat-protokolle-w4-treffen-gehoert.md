### Geändert (Protokolle)

- **Mehrere Gruppen, ein Kalender: der Termin steht nur dort, wo das Gruppentreffen ist.** Nutzen mehrere Gruppen denselben
  Kalender (live: Technik, Bildtechnik, Kamera, Stream, Tontechnik), stand jeder Termin mit Besprechungsanfrage in allen
  diesen Gruppen unter „Kommend“, „Noch ohne Protokoll“ und „Protokoll nachtragen“ – und es entstand versehentlich ein
  zweites Protokoll in der falschen Gruppe. Jetzt gilt „das Gruppentreffen entscheidet“: Ein Termin, zu dem eine Gruppe
  weder ein eigenes Gruppentreffen noch ein eigenes Protokoll hat, wird dort ausgeblendet, wenn eine **andere Gruppe
  desselben Kalenders** ein Gruppentreffen zur selben Startzeit oder ein Protokoll zu diesem Termin hat. Wer selbst eins
  hat, sieht den Termin weiter (auch wenn die andere Gruppe ebenfalls eins hat); Gruppentreffen und Protokolle ohne Termin
  sind nie betroffen. Trifft sich nur ein Teilteam, legt es in seiner Gruppe ein Gruppentreffen zur Startzeit an. Hat keine
  Gruppe eins, bleibt der Termin überall sichtbar.
- **Nicht lesbare Gruppen zählen nicht.** Darf die Person die andere Gruppe oder ihre Gruppentreffen nicht lesen, oder
  antwortet ChurchTools gerade nicht, bleibt der Termin sichtbar und die Liste lädt trotzdem; im Browser-Log steht eine
  Warnung mit dem Grund (ohne Namen). Die anderen Gruppen werden nur gefragt, wenn es überhaupt Termine ohne eigenes
  Treffen oder Protokoll gibt.

### Intern

- `shared/protokolle/sitzungen.ts`: `fremdeTermineAus` (die eine Regel), `nurTermin`, `GruppeImSelbenKalender`. Angewandt an
  der einen Stelle `ohneFremdeTermine` in `protokolle/src/lesen.ts` – für `ladeSitzungen` (damit auch die Startseite,
  „Nächste Sitzungen“, die Suche und „Protokoll beginnen“) und `sitzungenOhneProtokoll`. `sitzungenOhneProtokoll` und
  `sitzungenNochOhneProtokoll` brauchen dafür `modul`. Demo (`?demo`): Technik-Team teilt den Kalender mit dem Leitungsteam.
