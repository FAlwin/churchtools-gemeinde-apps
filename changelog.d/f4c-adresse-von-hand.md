### Intern

- **Anmeldungen: Die Adresse bei der Anmeldung „Von Hand“** (Etappe F, Scheibe F4c; veröffentlicht wird erst nach
  Etappe F). Entwurf `f4c-von-hand-v1`, entschieden 17.11.2026: „fragen, wenn anders“.
  - Bei einer bekannten Person ist das Feld mit der Adresse aus ihrem Profil **vorbelegt**. Hat sie keine, kommt das
    Eingetragene ins Profil; steht dort dieselbe, passiert nichts; steht eine **andere** da, zeigt das Fenster sie, und
    nur mit dem Schalter „Adresse in ChurchTools ersetzen“ wird sie ersetzt.
  - Eine neue Person bekommt die Adresse beim Anmelden. „Person dazu“ bei einer Adresse „einmal je Anmeldung“:
    vorbelegt mit der Adresse der ersten Person, ergänzt nur ein leeres Profil (ersetzt wird dort nie – die Adresse
    steht dann nicht im Fenster).
  - Geschrieben wird **nach** dem Eintragen (`PATCH /persons/{id}`, nachgelesen). Fehlt das Recht an der Person oder
    kommt sie nicht an, steht die Anmeldung trotzdem, und der Hinweis sagt, dass die Adresse von Hand nachzutragen
    ist. „Rückgängig“ stellt die alte Adresse wieder her.
  - Fehler behoben, der mit F4a kam: „Von Hand“ brach bei jeder eingetragenen Adresse ab („passt nicht zum
    Formular“), weil das nachgebaute ChurchTools-Formular Straße, PLZ und Ort nicht kannte (`formularAus`).
  - Die Suche (`ui/ct/personen`) liefert die Adresse mit – `adresseVonPerson` bleibt die eine Stelle dafür.
