### Neu (Anmeldungen)

- **Karte „Nachweise“ in der Veranstaltung** (N3b): Im Bereich „Vorbereiten“ steht je Nachweis-Art, für wen die Veranstaltung sie braucht. Im Fenster „Nachweise · Veranstaltung“ schaltest du jede Art ein und wählst **„Alle Angemeldeten“** oder **„Nur wenn …“** – dann eine Frage des Formulars (Ja/Nein, Auswahl, Mehrfachauswahl, Ankreuzen, auch die freie Antwort) und die Antworten, bei denen der Nachweis gebraucht wird. Es gibt kein Mindestalter. Wer Anmeldungen nicht bearbeiten darf, sieht die Karte nur. Die Einstellung wird bei „Wie eine frühere Veranstaltung“ mitkopiert.
- Eingetragen wird dabei noch niemand: Das geschieht erst, sobald eine Vertrauensperson oder ein Admin die Erweiterung öffnet (kommt mit N3c). Wer schon in der Nachweis-Gruppe ist, bekommt keine neue Aufforderung.
- Schaut „Nur wenn …“ auf eine Frage, die es nicht mehr gibt, steht das in Rot an der Karte und im Fenster – bis dahin braucht niemand den Nachweis (nie versehentlich alle). Wird eine Antwort der Frage umbenannt, zieht die Einstellung mit; wird sie entfernt, bleibt sie für früher so Antwortende bestehen, mit Hinweis.

### Intern (Anmeldungen)

- Neu `shared/anmeldung/nachweisBedarf.ts` mit der einen Regel `brauchtNachweis` (für N3c Eintragen und N3d Ampel) – sie übersetzt „Nur wenn …“ in einen Filter der Tabelle und fragt `tabellenFilter.ts`, keine zweite Vergleichslogik. Einstellung `nachweise` in `OeffentlicheEinstellungen` (höchstens 10 Arten), `nachweisArtenKurz` liest die Arten ohne ihre Mitglieder. `Karte`/`Zeile` der Veranstaltungsseite stehen jetzt in `VeranstaltungKarte.tsx`, die Zeile mit Schalter als `SchalterKnopf` in `ui/bedienung` (kein weiterer roher `<button>` in der Erweiterung). Entscheidungen E27 ff. in der Entscheidungsliste.
