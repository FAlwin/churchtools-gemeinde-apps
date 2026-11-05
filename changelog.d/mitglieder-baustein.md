### Intern (Anmeldungen + Organigramm)

- **Mitgliedschaften nur noch über einen Baustein** (`ui/ct/mitglieder.ts`, #848): anlegen per `PUT` mit `only_add`,
  ändern per `PATCH`, 404 heißt „nicht in der Gruppe“. Die Regel (#759) stand an sechs Schreibstellen in Anmeldungen
  (Nachrücken, Absagen zurückholen, von Hand eintragen, Zahlung, Leitung einrichten) und Organigramm, dazu viermal das
  Lesen und zweimal „404 = nicht dabei“. Richtig waren alle; der Wächter `ui/design/eineMitgliedschaft.test.ts` hält
  jetzt fest, dass niemand die Adresse einer Mitgliedschaft selbst baut. Am Verhalten ändert sich nichts.
