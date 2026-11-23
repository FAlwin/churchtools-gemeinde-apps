### Neu (Protokolle)

- **Events anlegen beim Eintragen in den Kalender (W15-3).** Im Fenster „In Kalender eintragen“ gibt es jetzt – wie im ChurchTools-Dialog „Termin erstellen“ – den Reiter **„Events“** zwischen „Kalender“
  und „Ressourcen“ (nur, wenn du in ChurchTools im **gewählten Kalender** Events anlegen darfst – wechselst du den Kalender, kommt der Reiter oder geht). Die Tabelle **Event-Datum | Eventvorlage** hat
  **eine Zeile je Einzeltermin der Reihe** (Datum und Uhrzeit untereinander, ganztägig nur das Datum; ohne Wiederholung genau eine Zeile, höchstens 200 – dann steht der Hinweis „Es werden nur die ersten
  200 Termine gezeigt“) und je Zeile eine Auswahl der **Eventvorlagen** (leer = für diesen Termin kein Event; auch die Vorlage „Standard“ funktioniert). Wählst du bei mehreren Zeilen eine Vorlage, fragt das
  Fenster wie ChurchTools: **„Soll die Vorlage für alle Termine übernommen werden?“** – Bestätigen setzt sie in allen Zeilen, Abbrechen nur in dieser. Am Handy wird jede Zeile zur Karte.
- **Ausnahmen, weitere Termine, Bis und Wiederholungsart** wirken auf die Zeilen: Die Erweiterung rechnet die Einzeltermine selbst aus (täglich, wöchentlich, monatlich nach Datum und nach Wochentag,
  jährlich, manuell – wie ChurchTools: gibt es den 31. oder 29.02. nicht, rutscht der Termin in den Folgemonat, und es geht von dort weiter) und schickt für jedes Event den **genauen Beginn** des Einzeltermins mit, auch über die Zeitumstellung hinweg.
- **Ehrlich nachgelesen:** Nach dem Speichern liest die Erweiterung die Events nach. Fehlt eines, bleibt der Termin stehen, der Vermerk im Protokoll entsteht trotzdem, und das Fenster nennt die Termine,
  für die du das Event in ChurchTools anlegen musst („Fertig“ schließt es). Fehlen Buchung und Event, steht beides in **einer** Meldung. Ließ sich das Nachlesen nicht erledigen, steht das
  ausdrücklich da – nicht als „fehlt“.
- Bei **„Nur verknüpfen“** werden keine Events angelegt – der Reiter sagt es und ist gesperrt. Termin-Vorlagen, die erkennbar eine Eventvorlage nennen, setzen sie in alle Zeilen; ihr Format ist noch
  nicht gemessen, ohne erkennbare Angabe bleibt alles leer. „Als Vorlage speichern“ schreibt keine Events.

### Intern (Protokolle)

- Regeln ohne Oberfläche: `shared/protokolle/terminReihe.ts` (`einzeltermine`: die Einzeltermine einer Reihe, Obergrenze 200; `einzelterminBeginn`: exakter UTC-Beginn je Tag), `terminEvents.ts`
  (`eventVorlagenAus`, `eventsFuer`, `vorlageFuerAlle`/`vorlageFuerZeile`, `eventHinweis`, `hinweiseZusammen` – die eine Stelle für „fehlt/unklar“-Hinweise von Buchungen und Events), Recht
  `shared/ct/eventRechte.ts` (`churchservice` „edit events“, über `start.ts` bis ins Fenster). `Eintrag.events` (Tag → Eventvorlage, **0 ist gültig**); `TerminVorlage.eventVorlage`;
  `terminRumpf` schreibt `events: [{startDate, eventTemplateId}]`. Lesen/Nachlesen `protokolle/src/eventsLesen.ts` (`ladeEventVorlagen`, `eventsNachlesen`), `terminLegen` liefert `events`.
  Oberfläche `TerminEvents.tsx`. Testnachbau und `?demo` kennen Eventvorlagen und Events.
