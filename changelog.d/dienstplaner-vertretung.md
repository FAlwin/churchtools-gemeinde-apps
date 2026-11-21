### Neu (Dienstplaner)

- **Vertretung suchen** (E5c-6). Wer seinen zugesagten Dienst nicht machen kann, fragt mit einem Klick das Team – ohne Planer. Am zugesagten Dienst steht neben
  „Tauschen“ der leise Knopf **„Vertretung suchen“** (Start, Dienste, Termin-Ansicht; nicht an einer offenen Anfrage).
  - **Das Fenster:** Wer im Team den Dienst an genau diesem Termin machen kann – **Hat Ja gesagt**, **Vielleicht** (mit Kommentar) und **Ohne Antwort** –, mit einem
    Haken je Person („Ja“ vorab) und einer freiwilligen Nachricht. Wer am Tag schon eingeteilt ist, Nein gesagt hat oder abwesend ist, steht nicht da. Ein gefüllter
    Knopf: **„Absagen und fragen“** (ohne Haken nur **„Absagen“**).
  - **Der Ablauf:** erst die Markierung „Vertretung gesucht“ speichern, dann den Dienst absagen, dann je gefragter Person eine eigene Mail (mit Knopf zum Dienstplaner,
    die Leitung bekommt eine Kopie). Scheitert eine der ersten beiden Stufen, ist nichts abgesagt und nichts verschickt. Scheitern nur Mails, ist abgesagt – das Fenster
    sagt, an wen nicht, und „Erneut senden“ schickt nur an diese, nur auf Klick.
  - **„Für dich offen“:** Jeder aus dem Team sieht auf Start „Anna sucht eine Vertretung“ mit **„Übernehmen“** – solange **der abgesagte Platz** frei ist (die Markierung merkt sich dessen `index`; ein anderer, schon vorher freier Platz zählt nicht, und „Übernehmen“ nimmt nie einen anderen). Wer in dem Dienst schon eingeteilt ist, sieht die Zeile nicht.
    Wer zuerst drückt, hat den Dienst; zu spät heißt „Schon übernommen – danke!“; ohne das ChurchTools-Recht „freie Plätze selbst eintragen“ steht „frag die Leitung“.
  - **Planen:** Der freie Platz trägt das Schild **„Vertretung gesucht“** („Anna hat abgesagt · gefragt: Ben, Finn“), bis jemand übernimmt – nur an dem Platz, den sie abgesagt hat.
  - **Voraussetzung in ChurchTools:** Für „Übernehmen“ braucht das Team das Gruppenrecht `+entry free` (siehe `docs/betrieb/DIENSTPLANER.md`).

### Geändert (Dienstplaner)

- Der Hinweis am Notizfeld in „Wann kann ich?“ stimmte nicht („Kann deine Dienstgruppe sehen“): Die App zeigt die Antworten nur den **Planern** der Dienstgruppe – und
  jedem, der am Termin eine Vertretung sucht. Der Text sagt es jetzt.

### Intern (Dienstplaner)

- Neuer optionaler Teil im eigenen Wert der Ablage „Antworten <Dienstgruppe>“ (`vertretungen`, `fassung` bleibt 1; alte Werte gelten weiter). **„Wann kann ich?“ erhält
  ihn beim Speichern** (`eigeneAntwortenSchreiben` ohne Angabe = was frisch gelesen dasteht); vergangene Termine fallen heraus. Neu in `shared/dienstplan/`:
  `vertretung.ts` (Vorschläge, „gilt nur bei freiem Platz“, Mail-Texte, `uebernehmen`), `absagenNachZusage` (`antworten.ts`), `vertretungMarkieren` (`verfuegbarkeit.ts`),
  `TerminZeile.freiePlaetze` (Dienst + `index` je freiem Platz). `ladePersonen` kann auf Wunsch die Leitung je Gruppe liefern (`rollen`). Neues Flaggen-Symbol (`flag`).
