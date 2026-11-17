### Intern

- **Anmeldungen: Die Adresse in Tabelle, Druckliste und „Anmeldung ansehen“** (Etappe F, Scheibe F4b; veröffentlicht
  wird erst nach Etappe F):
  - Gelesen wird **aus dem Profil der Person** (`GET /persons`: Straße, PLZ, Ort) – also der aktuelle Stand, nicht der
    vom Tag der Anmeldung. Darf man die Adresse nicht sehen, bleibt die Zelle leer.
  - Die Adresse ist eine Frage im gemeinsamen Spaltenkatalog (`fragen`/`frageAntwort` in `druckliste.ts`) – dieselbe
    Regel für Tabelle (je Anmeldung und je Person), Summenzeile („n ausgefüllt“) und Druckliste. Einmal je Anmeldung
    gefragt: in der Zeile der Anmeldung die Adresse der ersten Person, je Person die eigene.
  - Im Fenster einer Anmeldung steht sie je Person – nur, wenn das Formular nach der Adresse fragt.
  - **Nicht** im Rückweg der Antworten (`antwortenAus`): Eine Adresse im Profil gibt es auch ohne diese Anmeldung – die
    Nachprüfung meldete sonst „beantwortet, obwohl ausgeblendet“.
  - Demo: Maria, Jonas und Tom haben eine Adresse.
