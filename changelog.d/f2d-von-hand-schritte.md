### Intern

- **Anmeldungen: Anmeldung von Hand in Schritten** (Etappe F, Scheibe F2d; noch nicht freigegeben, veröffentlicht
  wird erst nach Etappe F). Klick-Runde 8: „auch in Schritten“.
  - Hat das Formular Schritte, blättert das Fenster „Anmeldung von Hand“ wie das Formular – Fortschritt oben, unten
    „Abbrechen · Weiter“, „Weiter“ prüft nur die Pflichtfragen der Seite; „‹“ oben geht eine Seite zurück (auf der
    ersten zur Suche). Unterschrift auf Papier, Auswahl, Platz und Betrag stehen im letzten Schritt. Dasselbe
    Blättern wie im Formular (`useSchritte`, `SchrittFortschritt`).
  - **„Person dazu“:** nur die Seiten mit Fragen je Person (`nurPerson`). Geprüft wird jetzt mit dem ganzen Formular,
    gemeldet nur, was die Person betrifft (`nurPersonenPfade`) – vorher fehlte der Kontakt-Teil, und eine Pflichtfrage
    in einem übersprungenen Schritt aus dem Kontakt-Teil hätte die Anmeldung aufgehalten.
  - **Nachprüfung:** Eine Antwort in einem Schritt, der übersprungen worden wäre, zählt jetzt auch als Hinweis – der
    Satz nennt den Schritt und seine Bedingung. Vorher wurden nur Fragen mit eigener Bedingung geprüft.
