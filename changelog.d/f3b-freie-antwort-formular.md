### Intern

- **Anmeldungen: freie Antwort im Formular und bei der Anmeldung von Hand** (Etappe F, Scheibe F3b; veröffentlicht
  wird erst nach Etappe F). Nach dem abgenommenen Entwurf `f3-freie-antwort-v1`:
  - „Textfeld klappt auf“: Das Feld erscheint erst, wenn die freie Antwort gewählt ist, und bekommt gleich den Fokus;
    wird etwas anderes gewählt, klappt es wieder zu.
  - „Textfeld steht immer da“: bei Eine Antwort und Mehrere Antworten in der Zeile der freien Antwort („Sonstiges:
    …“), bei Ja / Nein und Auswahlliste darunter. Wer hineintippt, wählt die freie Antwort mit.
  - Ist die Frage Pflicht, steht bei fehlendem Text „Bitte „Andere Gemeinde“ eintragen.“ – auch beim Blättern und von
    Hand. Auswahlliste und Mehrere Antworten zeigen die freie Antwort jetzt ebenfalls (`wahlAntworten`).
  - Der Schlüssel `<Feld-ID>.frei` steht nur in `freieAntwort.ts` (`freiEingabe` für Formular, Vorschau und von Hand).
  - Demo: „Bereich“ der Lobpreisfreizeit hat „Anderer Bereich“, Jonas hat dort „Fotos“ eingetragen.
