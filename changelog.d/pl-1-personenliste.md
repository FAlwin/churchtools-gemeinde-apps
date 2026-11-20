### Neu (Dienstplaner)

- **Die Personenliste einer Dienstgruppe wird angezeigt** (Scheibe PL-1 – nur Ansehen; Anlegen und Ändern kommen mit PL-2).
  Sie liegt als **ein Wert je Dienstgruppe** in der Schublade der Entwürfe und enthält die **Reihenfolge** der Personen, **Tags**
  (z. B. „Begleitung“ mit Kürzel „B“) je Person und Dienst und die **Pause** je Person (bis zu einem Datum oder ohne Ende).
  Ohne gespeicherte Liste sieht alles genau so aus wie bisher.
  - **„Personen“:** Die Zeilen eines Dienstes stehen in der gespeicherten Reihenfolge, wer fehlt, danach alphabetisch. Wer an allen
    gezeigten Terminen **pausiert** oder **ganz abwesend** ist (und dort nicht eingeteilt), steht **unten im Block, blass**, unter der
    Zeile „In Pause oder ganz abwesend · N“ – bleibt aber einteilbar. Bei einer Pause steht „Pause bis 31.01.27“ statt „auch …“.
    Die **Tags** erscheinen als kleines **Kürzel unten rechts am Personenbild**, der volle Name steht beim Darüberfahren; unter der
    Legende „Antwort der Person“ nennt eine Zeile **„Tags:“** alle Kürzel der gezeigten Dienste.
  - **„Wer kann?“:** Hat die Dienstgruppe eine Reihenfolge, steht jeder Abschnitt (bzw. die eine Liste) in dieser Reihenfolge –
    die Überschrift sagt „In der Reihenfolge der Personenliste“; „N× im Monat“ bleibt sichtbar. Wer **pausiert**, steht unter
    „Kann nicht / abwesend“ (in der einen Liste blass am Ende) mit „Pause bis …“. Die Kürzel stehen grau hinter dem Namen.
  - **PDF „Personen“:** Bei „Eine Gruppe“ in der gespeicherten Reihenfolge, beim ganzen Plan weiter alphabetisch. Die Tags stehen grau
    mit vollem Namen hinter dem Namen („Clara Dyck · Begleitung, Leitung“); gilt ein Tag nur für einen Teil der gezeigten Dienste einer
    Person, steht der Dienst dahinter („Einweisung (Ton)“). „Je Person“ bleibt unverändert.

### Intern (Dienstplaner)

- Neue Regeln **an einer Stelle** (`shared/dienstplan/personenliste.ts`): Lesen und Prüfen des Werts (`personenlisteAus`),
  Sortierung (`sortiereNachListe`), Tags (`tagsFuer`) und Pause (`pauseAm`, `pausiertAnAllen`, `pauseText`). Raster, „Wer kann?“ und PDF
  rufen sie nur auf. Die Liste kommt aus denselben Werten der Schublade wie die Entwürfe (keine zusätzliche Anfrage,
  `EntwuerfeDaten.personenlisten`); die Leser der Entwürfe ignorieren sie weiterhin, und bei zwei gleichzeitigen Werten gewinnt dieselbe
  Regel wie bei Entwürfen (höhere Version, spätere Zeit, höhere ID – `gewinnt` in `entwuerfe.ts`, jetzt für beide).
- Die Demo (`?demo`) hat für Musik und Technik je eine Personenliste mit Tags, Reihenfolge und Pause.
