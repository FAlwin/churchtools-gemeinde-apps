### Intern

- **Anmeldungen: Team-Mail** (Etappe F, Scheibe F7c; veröffentlicht wird erst nach Etappe F). Entwurf `f7-mails-v1`,
  Klick-Runden 11 und 12, Messung M2 – ohne Server-Teil.
  - Nach dem Absenden schickt das Formular über „Leiter kontaktieren“ (`POST /publicgroups/{id}/mailToLeaders`, ohne
    Login, mit frischem Schlüssel) eine Mail an alle Leiter der Gruppe mit Mail-Adresse. Absender ist, wer anmeldet –
    Antworten gehen an diese Person. Eine Mail je Anmeldung; „Noch einmal“ schickt eine eigene für den Rest.
  - Inhalt in einem Absatz (ChurchTools übernimmt keine Umbrüche): eigener Text mit gefüllten `[Frage]`, Anmelde-Nr.,
    Antworten zur Anmeldung, je Person Name, Stand („Platz“, „Warteliste“, „muss die Anmeldung noch per Mail
    bestätigen“) und ihre Antworten; bei noch zu bestätigenden ein Vermerk. Ausgeblendete Fragen zählen nicht.
  - Scheitert die Mail (Netz, keine Leitung mit Mail-Adresse → 500), steht die Anmeldung trotzdem; die Ergebnis-Seite
    bleibt, wie sie ist. Bei „Von Hand“ gibt es keine Team-Mail.
  - Fenster „Mails“, neuer Reiter **„Team-Mail“**: Schalter (Standard an), an wen sie geht, eigener Text mit „Antwort
    einfügen“, Häkchen „Diese Antworten kommen mit“ (alle an, Hinweis auf Gesundheitsangaben), Vorschau des Absatzes.
    Gespeichert in den Einstellungen der Veranstaltung (`teamMail`) – nur, wenn sie vom Standard abweicht.
  - Name und Mail-Adresse der Kontaktperson an EINER Stelle (`kontaktVon`): Anmeldung, Ergebnis-Seite und Team-Mail
    lasen sie vorher teils über den festen Schlüssel `mail`.
