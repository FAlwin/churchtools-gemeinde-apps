### Geändert (Anmeldungen + Protokolle + Organigramm)

- **„Heute“ geht nach der Uhr der Gemeinde, nicht nach der des Geräts** (#847, Schritt Z1). Die Zeitzone kommt aus
  ChurchTools (`/api/config`) und wird beim Start einmal gelesen – in den Erweiterungen und im öffentlichen Formular.
  In Deutschland ändert sich nichts Sichtbares; wer im Ausland ist, sieht „heute“ jetzt am selben Tag wie die Termine.
  Antwortet ChurchTools beim Start nicht, gilt wie bisher die Zeitzone des Geräts.
