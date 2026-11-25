### Neu (Protokolle)

- **Besprechungsanfragen beim Eintragen in den Kalender (W15-4).** Im Fenster „In Kalender eintragen“ gibt es – wie im ChurchTools-Dialog „Termin erstellen“ – den Reiter **„Besprechungsanfragen“** zwischen
  „Kalender“ und „Events“, **aber nur, wenn der gewählte Kalender ein Gruppenkalender ist** (beim Gemeindekalender fehlt er, wie in ChurchTools). Ein Schalter **„Besprechungsanfrage erstellen“** (aus ist die
  Vorgabe) schaltet das Suchfeld **„Nach Name oder Gruppe suchen …“** und die Tabelle **Name (mit Gruppe) | Status** frei; **du** bist vorgewählt und nicht abwählbar, jede Person steht nur einmal da, „alle“
  wählt die angezeigten. Wiederholungstermine werden als Serie angefragt.
- **Die Mail kommt sofort – das Fenster sagt es vorher:** Statt „Es werden keine Einladungen verschickt.“ steht im Fuß „Die Einladung geht **sofort** per Mail an N Personen.“ (du selbst bekommst keine). Anfragen
  gehen nur mit, wenn der Reiter da ist, der Schalter an ist und nicht „Nur verknüpfen“ gilt. **Wechselst du den Kalender, ist die Auswahl geleert** – nichts wird versehentlich aus einem anderen Kalender mitgeschickt.
  Termin-Vorlagen kennen keine Besprechungsanfragen und übernehmen oder speichern nichts davon.
- **Ehrlich nachgelesen:** Nach dem Speichern liest die Erweiterung die Anfragen des neuen Termins nach. Fehlt eine Person, bleibt der Termin stehen, der Vermerk im Protokoll entsteht trotzdem, und das Fenster nennt
  die Person (zusammen mit fehlenden Buchungen oder Events in **einer** Meldung; „Fertig“ schließt es). Ließ sich das Nachlesen nicht erledigen, steht das ausdrücklich da – nicht als „fehlt“.
- **Kein zweiter Termin nach unklarer Antwort:** Antwortet ChurchTools beim Anlegen nicht eindeutig und der Termin ist nicht auffindbar, bleibt „Speichern“ gesperrt, bis die Prüfung „steht schon da?“ neu gelaufen
  ist. Findet sie den Termin, heißt der Knopf „Verknüpfen“ – es entsteht weder ein zweiter Termin noch eine zweite Mail. (Das gilt jetzt auch für Termine ohne Einladung.)

### Intern (Protokolle)

- **Die Regel „ich bekomme keine Mail“ steht jetzt an einer Stelle:** `shared/protokolle/einladungsmail.ts` (`mailsAnAndere`) – benutzt von „Nächste Sitzung festlegen“, „Sitzung bearbeiten“ (auch Serie und Absagen),
  „Protokoll löschen“ und dem neuen Reiter. Der Satz „Die Einladung geht sofort per Mail an N Personen.“ ist der Baustein `EinladungHinweis.tsx`.
- Regeln `shared/protokolle/besprechungsanfrage.ts` (`kandidatenAus` entdoppelt nach Personen-ID, `kandidatenFiltern`, `angefragte`, `anfrageHinweis`), Lesen/Nachlesen `protokolle/src/besprechungsanfragen.ts`
  (`ladeKandidaten`, `anfragenNachlesen`), Oberfläche `TerminAnfragen.tsx`; `KalenderEintrag.gruppe`, `terminLegen({ eingeladen })` liefert `anfragen`. Testnachbau (mit Mail-Protokoll beim Anlegen) und `?demo`
  kennen Gruppenkalender, Kandidaten und Anfragen.
- **Am Handy eine Auswahl „Bereich“ statt der Reiter.** Vier Reiter (bald fünf) passten nicht in die Breite, der Rest war nur durch seitliches Wischen zu finden. Am Handy steht oben
  jetzt eine Auswahl **„Bereich“** (Kalender, Besprechungsanfragen, Events, Ressourcen) – wie dort schon die Termin-Vorlagen; am PC bleiben die Reiter wie in ChurchTools.
