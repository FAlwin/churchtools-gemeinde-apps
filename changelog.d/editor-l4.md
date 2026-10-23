### Neu (Musik-App, Lied-Editor L4)

- **Liedinfo im Editor:** rechts umschaltbar **Vorschau | Liedinfo** (am Handy Reiter **Infos**) mit Titel,
  Interpret/Autor, Tonart, Tempo, Takt, CCLI-Nummer und Copyright – aus ChurchTools, gespeichert mit „Speichern“
  oben. Steht im Notenblatt etwas anderes, zeigt das Feld „Im Notenblatt steht: …“ mit **übernehmen**; ist das Feld
  in ChurchTools leer, wird es aus dem Notenblatt vorbelegt. Ohne Recht auf die Stammdaten nur zum Ansehen.
- **Die Kopfzeilen `{title}`, `{artist}`, `{tempo}`, `{time}`, `{ccli}`, `{copyright}` wandern beim Speichern nach
  ChurchTools** und verlassen das Notenblatt – aber erst, wenn ChurchTools den Wert nachweislich hat. Scheitert das
  Speichern in ChurchTools, wird gar nichts gespeichert. `{key}` (notierte Tonart) bleibt. Lieder, die nie im
  Editor gespeichert werden, bleiben wie sie sind. Im Text sind diese Zeilen ausgeblendet, im „ChordPro-Text“
  sichtbar. Die Vorschau zeigt das Blatt, wie es nach dem Speichern aussieht.
- **SongSelect-Import:** Leere ChurchTools-Felder werden aus dem importierten Notenblatt gefüllt (vorhandene nie
  überschrieben), danach verlassen die Kopfzeilen das Notenblatt. Klappt das Füllen nicht, kommt das Notenblatt
  trotzdem unverändert an.

### Intern (Lied-Editor L4)

- `shared/ct/liedinfo.ts` (Felder, Vergleich, `liedinfoZeilenEntfernen`, `LIEDINFO_ZEILE` – eine Grammatik für
  Entfernen und Ausblenden, `tempoAusText`), `shared/ct/liedinfoImport.ts`, `client/src/utils/liedinfoFormular.ts`
  (auf den Formularen des Stammdaten-Blatts), `useLiedinfoQuelle`. `metaWerte` liest alle Zeilen eines Felds
  (SongSelect bringt zwei `{artist}`).
