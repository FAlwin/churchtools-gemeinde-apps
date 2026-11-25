### Neu (Protokolle)

- **Anmeldung beim Eintragen in den Kalender (W15-5).** Im Fenster „In Kalender eintragen“ gibt es – wie im ChurchTools-Dialog „Termin erstellen“ – den Reiter **„Anmeldung“** zwischen
  „Besprechungsanfragen“ und „Events“ (am Handy in der Auswahl „Bereich“). Er erscheint, wenn du in mindestens einem Gruppentyp Gruppen anlegen darfst. Ein Schalter **„Gruppen für Anmeldung erstellen“**
  (bei einem Einzeltermin „Gruppe für Anmeldung erstellen“, aus ist die Vorgabe) öffnet **Gruppentyp** (nur deine erlaubten Typen, „Kleingruppe“ vorgewählt), **Tage im Voraus** (14), **Gruppe als
  Kopiervorlage** (nur Gruppen des gewählten Typs – ein Typwechsel leert sie) und **Tage nach dem Termin bis zum Beenden**. Darunter zeigt die Vorschau, welche Gruppen ChurchTools direkt erstellt und mit dem
  Kalender verknüpft – ein Eintrag je Einzeltermin zwischen heute und „heute + Tage im Voraus“.
- **ChurchTools legt die Gruppen sofort an – das Fenster sagt es vorher:** Im Fuß steht „Beim Speichern legt ChurchTools sofort N Gruppen an.“ Die Anmeldung geht nur mit, wenn der Reiter da ist, der Schalter an ist, ein
  erlaubter Gruppentyp gewählt ist und nicht „Nur verknüpfen“ gilt. Wird der Termin gelöscht, gehen seine Gruppen mit (in ChurchTools gemessen).
- **Ehrlich nachgelesen:** Nach dem Speichern prüft die Erweiterung, dass die Anmeldung am Termin steht und dass zu jedem angekündigten Einzeltermin eine Gruppe „<Titel> – TT.MM.JJJJ, HH:MM“ da ist. Fehlt etwas, bleibt der
  Termin stehen, der Vermerk im Protokoll entsteht trotzdem, und das Fenster nennt es (zusammen mit Buchungen, Events und Anfragen in **einer** Meldung; „Fertig“ schließt es). Ließ sich das Nachlesen nicht erledigen, steht das
  ausdrücklich da – nicht als „fehlt“. Es wird nie etwas gelöscht.
- **Termin-Vorlagen mit Anmeldung:** Eine Vorlage mit Gruppentyp schaltet den Schalter an und füllt Typ, Tage, Kopiervorlage und Beenden (nur mit erlaubtem Typ); „Als Vorlage speichern“ schreibt dieselben Felder, wenn der Schalter an ist.

### Intern (Protokolle)

- Regeln `shared/protokolle/terminAnmeldung.ts` (Vorgaben, `anmeldungTermine` = **eine** Rechnung für Vorschau, Fuß und Nachlesen, Rumpf `signup`, Hinweise), Recht `shared/ct/gruppenTypRechte.ts`
  (`churchdb` „create groups of grouptype“), Lesen/Nachlesen `protokolle/src/anmeldungLesen.ts` (Gruppentypen, Gruppen eines Typs über `ctAlleSeiten`), Oberfläche `TerminAnmeldung.tsx`; `Eintrag.anmeldung`,
  `TerminVorlage.anmeldung…`, `terminLegen` liefert `anmeldung`. Testnachbau und `?demo` legen die Gruppen wie ChurchTools an (drei Gruppentypen, einer nicht erlaubt).
- Der Schalter mit Beschriftung ist jetzt ein Baustein (`TerminSchalter.tsx`, vorher in `TerminAnfragen.tsx`), der Satz vor dem Speichern „ChurchTools tut es sofort“ ebenso (`SofortHinweis` in `EinladungHinweis.tsx`).
