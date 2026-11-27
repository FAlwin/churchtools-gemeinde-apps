### Neu (Anmeldungen)

- **Nachweise: Grundlage für die Ampel in der Veranstaltung** (N3a). Die Erweiterung legt beim Einrichten (Speichern einer Nachweis-Art oder Öffnen der Seite „Nachweise“ durch einen Admin) im eigenen Datenspeicher die Ablage **„Nachweis-Stand“** an. Wer „Anmeldungen sehen“ hat – also auch die Leitungen der Veranstaltungen –, darf sie lesen; die Vertrauenspersonen dürfen schreiben. Rechte werden nur ergänzt, nie entzogen, und danach nachgelesen; wer später „Anmeldungen sehen“ bekommt, erhält das Leserecht beim nächsten Öffnen durch einen Admin.
- Öffnet eine Vertrauensperson (oder ein Admin) die Seite „Nachweise“ – auch nach „Einsicht festhalten“ –, schreibt die Erweiterung je Art und Person **nur „gültig bis“, „offen“ oder „rot“** dorthin, nie das Ergebnis oder das Ausstellungsdatum. Geschrieben wird nur, was sich geändert hat; wer die Art verlassen hat, fällt weg. „Rücksprache“ und „fehlt seit über 4 Wochen“ stehen beide als „rot“ da, so verrät der Stand kein Ergebnis. Sichtbar wird das erst mit der Ampel in der Veranstaltung (N3d).

### Geändert (Anmeldungen)

- **Vertrauenspersonen dürfen Personen in ihre Nachweis-Gruppe eintragen** (Recht „Gruppenmitglieder hinzufügen“ an der Leiter-Rolle der Gruppenart „Nachweis“) – Voraussetzung für das Eintragen beim Öffnen (N3c) und „Person eintragen“ (N4). Bestehende Installationen bekommen das Recht beim nächsten Öffnen der Seite „Nachweise“ durch einen Admin.
- Das Fenster „Nachweis-Art“ nennt nach einem Teilerfolg einen weiteren Schritt: „Ablage ‚Nachweis-Stand‘ für die Leitungen der Veranstaltungen“.

### Intern (Anmeldungen)

- `rechteErgaenzenAn` (`shared/ct/gruppenart.ts`) ergänzt Rechte an Status, Gruppenart-Rolle, Gruppenrolle oder Person (`rechteErgaenzen` nutzt es), `rechtTraegerLesen` liest die Träger eines Rechts aus `assignment-summary`. Neu `shared/anmeldung/nachweisStandAblage.ts` (Format, Schreiben, Lesen mit „nicht lesbar“ ≠ „leer“, Einrichten) und `standFuerLeitung` in `nachweisStand.ts` als einzige Abbildung Stand → Leitung. Entscheidung zur Ablage: E26 in der Entscheidungsliste.
