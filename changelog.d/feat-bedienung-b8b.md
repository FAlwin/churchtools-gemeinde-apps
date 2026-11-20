### Geändert (Dienstplaner + Organigramm + Protokolle + Website + Anmeldungen + Gebetsabend)

- **Ein Seitenkopf in jeder Erweiterung.** Oben steht klein der App-Name – ohne Gemeindenamen, der steht schon in der
  ChurchTools-Leiste –, darunter die unterstrichenen Reiter. **„Hallo …“ steht nur noch auf der Startseite** (im Organigramm stand
  es bisher auf jedem Reiter). Alle Apps nutzen die ganze Fensterbreite.
- **Gewohnheit: „Einstellungen“ ist jetzt der letzte Reiter.** Im **Organigramm** (Gruppen-Admins), in den **Anmeldungen**
  (Gruppen-Admins) und im **Gebetsabend** (wer die Einstellungen ändern darf) steht „Einstellungen“ ganz rechts in der Reiterleiste,
  am Handy ganz rechts unten, statt als Knopf neben „Hallo …“. Der Reiter öffnet dasselbe Fenster wie vorher der Knopf; wer die
  Einstellungen nicht öffnen darf, sieht den Reiter nicht. In den Anmeldungen und im Gebetsabend gibt es dafür nun die Reiter
  „Start“ und „Einstellungen“. „Neue Veranstaltung“ bleibt in den Anmeldungen neben „Hallo …“. Dienstplaner, Website und Protokolle
  haben keine Einstellungen als Fenster – in den Protokollen bleibt „Verwaltung“ der letzte Reiter.
- **Ein Status-Etikett.** „Leitung“/„Mitglied“, „eingerichtet“, „Entwurf“, „Warteliste 2“, „offen“, „nur ansehen“, „wechselt“,
  „neu“ und alle ähnlichen Hinweise haben jetzt dieselbe Form in vier Farben: grau (leise Auskunft), blau (deine Rolle, wartet auf
  dich), grün (in Ordnung), rot (braucht Aufmerksamkeit). Zwei Hinweise, die bisher gelb waren („Ausnahme vom letzten Jahr“,
  „unvollständig“ bei den Wechseltagen), sind blau bzw. rot.

### Intern

- Neuer Baustein `Etikett` in `ui/bedienung` (vorher `anmeldungen/src/Etikett.tsx`; die `Marke` der Protokolle, die Chips der
  Kinder-&-Jugend-Seiten im Organigramm und die Pillen der Anmeldungen sind darauf umgestellt). `ErweiterungsSeite` kennt
  `einstellungen`, `startName` und zeigt „Hallo …“ nur bei aktivem erstem Reiter. Neuer Wächter `etiketten.test.ts`
  (Kapseln je App: Anmeldungen 10, Protokolle 1, Dienstplaner 2, Organigramm 1, übrige 0 – alle Knöpfe oder Wähler).
