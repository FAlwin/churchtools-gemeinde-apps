### Neu (Musik-App + Dienstplaner – Alwin, 30.10.2026)

- **Einen Punkt an einer bestimmten Stelle einfügen** – nicht mehr nur am Ende. Entwurf `einfuegen-entwurf.html`,
  abgenommen 30.10.2026 (A + B, am PC wie ChurchTools).
  - Im Fenster „Neuer Eintrag“ steht **„Einfügen nach“** (vorgegeben „Am Ende“); ein Tipp zeigt alle Punkte zur Wahl.
  - Im Fenster eines Punkts links unten **„Darunter einfügen“** (gesperrt, solange dort etwas ungespeichert ist).
  - **Am Rechner** erscheinen beim Drüberfahren neben dem Stift ein **Plus** – „Programmpunkt/Lied/Überschrift
    dahinter einfügen“ bzw. „… davor einfügen“, wie in ChurchTools – und ein **roter Papierkorb** mit derselben
    Rückfrage wie „Eintrag löschen“. Am Handy erscheinen sie nicht.
- **„Weitere Einstellungen“ beim Anlegen:** Infos je Gruppe, „Vor Gottesdienstbeginn“ und „An diesem Termin
  weglassen“ lassen sich gleich beim Anlegen setzen (zum Aufklappen). „Vor Gottesdienstbeginn“ startet mit der Seite der
  gewählten Stelle.

### Geändert (Musik-App + Dienstplaner)

- **„Vor Gottesdienstbeginn“ verschiebt nur noch diesen einen Punkt** (Alwin, 30.10.2026): Eingeschaltet rückt er
  direkt über „Beginn“, ausgeschaltet direkt darunter; alle anderen Punkte bleiben auf ihrer Seite – auch bei
  Überschriften (nur sie selbst). Vorher wanderte die Grenze, und alle Punkte darüber bzw. darunter wechselten mit. Der
  Hinweis am Schalter sagt, wohin der Punkt beim Speichern rückt.

### Intern (Musik-App + Dienstplaner)

- `vorlaufUmschalten` (ersetzt `beginnPositionFuer`), `anDieStelle` als eine Regel für Einfügen und Zurückholen,
  `angelegtePruefen` (frisch nachlesen statt der Antwort trauen), `vorlaufAnDerStelle`; `MenueListe` als gemeinsames
  Menü für den grünen Kopfknopf und das Plus an der Zeile; Fensterknopf-Art `link`; das Menü am Plus der Zeile hängt an `body` (`useAufklapp` kennt dafür `menue`), sonst schnitt die Ablauf-Karte es ab; ein `infosSchema` für Gesehen,
  Ändern und Anlegen. Gegenprobe: 15 Teile einzeln zurückgenommen, jeder macht Tests rot. TF-EDIT-15.
