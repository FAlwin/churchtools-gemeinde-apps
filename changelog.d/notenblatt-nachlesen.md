### Behoben (Musik-App)

- **Eine Liedversion oder das Original-Notenblatt kann beim Speichern nicht mehr verloren gehen** (#842). ChurchTools
  kann eine Datei nicht ersetzen, deshalb legt die App die neue Fassung daneben und löscht danach die alte. Gelöscht
  wurde bisher, sobald das Hochladen keinen Fehler meldete – hätte ChurchTools „erfolgreich“ geantwortet, ohne die
  Datei anzulegen, wäre die Version weg gewesen. Jetzt liest die App nach und löscht die alte Fassung erst, wenn die
  neue wirklich dasteht; sonst kommt „ChurchTools hat das Speichern bestätigt, die Datei ist aber nicht da. Es wurde
  nichts gelöscht.“ Gilt für Version ändern und umbenennen, das Original im Editor und das Holen aus SongSelect, in
  der Server-App wie in der Erweiterung. Beobachtet wurde der Fall bisher nicht; gefunden beim Code-Check vom
  04.11.2026.

### Intern (Musik-App)

- Testdoppel wie gemessen: `ctLiedAblage.testutil.ts` (Server) und `FakeCt` (Browser) legen hochgeladene
  Arrangement-Dateien mit neuer ID ab und blenden gelöschte aus; `uploadVerschwindet` / `ablageName` stellen den
  lügenden Erfolg und eine anders benannte Ablage nach.
