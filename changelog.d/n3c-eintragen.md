### Neu (Anmeldungen)

- **Nachweise: Eintragen beim Öffnen** (N3c). Öffnet eine Vertrauensperson einer Nachweis-Art oder ein Admin die Erweiterung, trägt sie alle in die Nachweis-Gruppe ein, die laut einer laufenden Veranstaltung den Nachweis brauchen – nur aktive Teilnehmer, nicht Wartende und nicht die Leitung. ChurchTools schickt dann die Aufforderung und die Einladung. Bei **„Alle Angemeldeten“** tragen Vertrauenspersonen und Admins ein, bei **„Nur wenn …“** nur Admins (die Antworten sehen Vertrauenspersonen nicht). Sichtbar ist nur eine leise Meldung („2 Personen zum Nachweis angemeldet.“).
- Wer schon in der Nachweis-Gruppe steht, wird nicht noch einmal eingetragen. Wer von einer Vertrauensperson ausgetragen wurde, kommt für dieselbe Veranstaltung nicht wieder hinein – für eine neue Veranstaltung schon.
- Leitungen sehen in der Karte „Nachweise“ jetzt den **Namen** einer Art, die sie selbst nicht sehen dürfen (statt „Nachweis-Art Nr. …“), sobald eine Vertrauensperson oder ein Admin die Erweiterung einmal geöffnet hat.

### Geändert (Anmeldungen)

- **Vertrauenspersonen sehen alle Anmeldegruppen samt Teilnehmern** (Recht „Gruppen eines Gruppentyps sehen“ für die Gruppenart „Anmeldung“ an der Leiter-Rolle der Gruppenart „Nachweis“), nicht deren Antworten. Bestehende Installationen bekommen das Recht, sobald ein Admin die Erweiterung öffnet.

### Intern (Anmeldungen)

- Neuer Kern `shared/anmeldung/nachweisEintragen.ts` (Anschluss `EintragPort`, Regel `eintragPlan`): höchstens 20 Versuche je Öffnen mit 0,5 s Pause, 429 beendet den Lauf sofort, Netz/5xx leise; gemerkt wird nur, was nachgelesen in der Gruppe steht. Ablage je Art „Name + Merkzettel“ (`artAngabenAbgleichen`, `artNamenLesen`) neben dem Stand, eine Schreibstelle `jeArtSchreiben`. `istSchonDrin` (`ui/ct/mitglieder.ts`) erkennt 403 `member.add.already-in-group`; Demo und Testattrappe schicken jetzt den echten Rumpf. `istAnmeldungArt`, `gruppenfelderAus`, `modulRechtVerlangen` als gemeinsame Bausteine. Entscheidungen E34–E37.
