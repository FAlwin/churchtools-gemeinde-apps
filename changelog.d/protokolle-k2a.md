### Neu (Protokolle, K2a)

- **Neues Protokoll ohne Termin** (Alwin 29.10.2026): Knopf „Neues Protokoll“ auf der Startseite (bei „Nächste
  Sitzungen“) und im Reiter „Sitzungen“ – für alle, die in einer Gruppe schreiben dürfen. Im Fenster wählt man die
  Gruppe (nur die, in denen man schreiben darf), Titel, Datum und Uhrzeit (vorbelegt wie „Neue Sitzung“; auch
  nachträglich möglich) und Vorlage / „Wie letztes Mal“ / leer. Auf Wunsch wird ein **Gruppentreffen** für die
  Anwesenheit mit angelegt. Kein Kalendertermin, keine Mail; danach öffnet sich das Protokoll gleich im Editor.

### Geändert (Protokolle)

- „Neue Sitzung“ und „Neues Protokoll“ im Reiter „Sitzungen“ sind die gemeinsamen grünen Knöpfe der Apps (`KopfKnopf`,
  wie „+ Gruppe erstellen“ in ChurchTools) statt eines eigenen kleineren Knopfs.

### Behoben (Protokolle)

- „Wie letztes Mal“ war nicht vorbelegt, wenn die Vorlagen schneller geladen waren als die Protokolle der Gruppe – dann
  stand die erste Vorlage fest. Die Vorbelegung folgt jetzt dem aktuellen Stand (eine Wahl für „Protokoll beginnen“
  und „Neues Protokoll“, `useAnfangWahl`).

### Intern

- Felder der Protokoll-Fenster an einer Stelle (`Fensterfelder.module.scss`); `planungFehler` kennt `zukunft: false`.
