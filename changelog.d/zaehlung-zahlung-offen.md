### Behoben (Anmeldungen)

- **„Zahlung offen“ auf der Startseite zählt wie Liste und Kennzahlen** – bisher zählte die Startseite jede aktive
  Person ohne Haken „bezahlt“, auch ohne Betrag; Liste und Kacheln zählen Anmeldungen mit offenem Betrag. Beim TEST
  Lobpreisabend stand so „5 Zahlungen offen“ neben „0,00 €“ (Fund der echten Prüfung von U1, 29.10.2026). `belegungAus`
  geht jetzt durch dieselbe Kette wie die Liste (`mitgliederstandAus` → `anmeldungenAus` → `listenZahlen`), aus den
  Mitgliedern, die die Startseite ohnehin lädt – keine Abfrage mehr. Getestet gegen die Daten, aus denen die Liste
  rechnet. Bekannte Lücke: Hat die erste Person einer Anmeldung abgesagt, fehlt deren Zahlung auf der Startseite (sie
  steht nur im Verlauf).
