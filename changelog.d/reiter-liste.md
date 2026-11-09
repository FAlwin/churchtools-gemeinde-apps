### Intern

- **Anmeldungen: was die Liste zeigt, als reine Funktion** (#845, Schritt 4, Scheibe 4c-2): `listenAnsicht` rechnet je
  Reiter die Zeilen (je Anmeldung oder je Person; gesucht, sortiert, Angeheftetes zuerst), die Absagen (neueste zuerst),
  die Wartenden nach Warteplatz und die Zahlen an den Reitern. Unverändert übernommen; `AnmeldungenReiter.tsx` hat
  statt 760 noch 710 Zeilen. Neue Tests (`listenAnsicht.test.ts`, mit den Erzeugern der Liste): Warteplatz statt
  Anmeldetag, neueste Absage zuerst, „je Person · Zahlung offen“, Angeheftetes je Person.
