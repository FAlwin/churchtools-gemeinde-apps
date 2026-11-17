### Intern

- **Anmeldungen: Baustein „Adresse“ – Straße, PLZ und Ort in den Personenfeldern** (Etappe F, Scheibe F4a;
  veröffentlicht wird erst nach Etappe F). Entwurf `f4-adresse-v1`, gemessen auf der Test-Instanz am 17.11.2026
  (`messung-m1-2026-11-17.md`):
  - Neu unter „Empfohlen“: **Adresse** mit drei Feldern (Straße und Hausnummer, PLZ, Ort – kein Land) und dem festen
    Hinweis „Wird im Profil in ChurchTools gespeichert.“ Sie ersetzt dort die frühere „Anschrift“ (ein Textfeld);
    Formulare, die sie schon haben, behalten sie.
  - An der Feldkarte wählt die Leitung **„einmal je Anmeldung“** (gilt für alle angemeldeten Personen) oder
    **„je Person“**. Pflicht heißt: alle drei Teile.
  - Gespeichert wird **an der Person** (`street`, `zip`, `city`), nicht als Spalte. Das Tool nimmt die drei
    Personenfelder ins Anmeldeformular von ChurchTools (nie als Pflicht dort) und liest nach; beim Freigeben zieht es
    sie nach, falls sie fehlen (z. B. bei einer Kopie).
  - Bei einer **bekannten Person** überschreibt ChurchTools die Adresse mit dem Klick in der Bestätigungsmail
    (gemessen M1, so gewollt). Leere Teile werden deshalb nie geschickt – sie würden eine vorhandene Adresse löschen.
  - Noch nicht: Tabelle, Druckliste, „Anmeldung ansehen“ und Nachprüfung (F4b), „Von Hand“ (F4c).
  - ⚠️ Neuer Feldtyp: Formular-Paket und Erweiterung zusammen hochladen (wie bei jedem neuen Baustein).
