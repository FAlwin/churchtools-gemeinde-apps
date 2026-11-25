### Neu (Protokolle)

- **„In Kalender eintragen“ kann jetzt, was der ChurchTools-Kalender beim Anlegen kann (W15-1).** Das Fenster baut den Reiter „Kalender“ des ChurchTools-Dialogs „Termin erstellen“
  nach – Aufbau, Wortlaut und Verhalten wie dort: links **„Termin-Vorlagen <Kalender>“** (am Handy eine Auswahl oben), rechts Kalender, Titel, Untertitel, „Nur für eingeloggte Personen
  sichtbar“, **Ganztägig**, **Beginn** und **Ende** mit Datum, Stunde und Minute (auch mehrtägig), **Wiederholungen** (Täglich, Wöchentlich, Monatlich nach Datum, Monatlich nach
  Wochentag mit „Erster … Letzter <Wochentag> im Monat“, Jährlich, Manuell) mit **Bis**, **Alle x Tage/Woche(n)/Monat(e)/Jahr(e)**, **Weitere Termine** und **Ausnahmen**, Beschreibung,
  Link, Ort (Name, Straße, PLZ, Ort, Zusatz) und Tags. Unten **„Ersteller über Änderungen informieren“** (vorgehakt wie in ChurchTools), „Abbrechen“ und **„Speichern“** – nur dieser
  Knopf ist gefüllt.
- **Termin-Vorlagen:** Eine Vorlage des gewählten Kalenders füllt das Formular (Titel, Uhrzeit, Dauer, Wiederholung samt „Bis“, Ort, Tags …; das Datum bleibt). „Ohne Vorlage“ stellt den
  Vorschlag aus dem Protokoll wieder her. **„Als Vorlage speichern“** (leiser Knopf links unten, nur mit dem ChurchTools-Recht „Termin-Vorlagen bearbeiten“ im Kalender) speichert nur die
  Vorlage, legt keinen Termin an und gilt erst als gespeichert, wenn sie in der neu gelesenen Liste steht.
- **Neue Tags** lassen sich nur anlegen, wenn du in ChurchTools Termin-Tags verwalten darfst; sonst wählst du vorhandene.
- Bleibt wie bisher: Vorbelegung aus dem Termin-Baustein, „Nur verknüpfen“ bei einem ähnlichen Termin am selben Tag, Nachlesen nach unklarer Antwort, Vermerk im Reiter und
  „Nochmal vermerken“. Es werden weiterhin keine Einladungen verschickt; ist „Ersteller informieren“ an, steht dazu ein Satz. Noch nicht dabei: „Im Auftrag von“ und „Bild“ sowie die
  weiteren Reiter von ChurchTools (Besprechungsanfragen, Anmeldung, Events) – sie folgen in eigenen Schritten; „Ressourcen“ ist mit W15-2 schon dabei.

### Geändert (Protokolle)

- Der Knopf im Fenster „In Kalender eintragen“ heißt jetzt **„Speichern“** (wie in ChurchTools; bei „Nur verknüpfen“ weiter „Verknüpfen“).
- Der Ort geht als `address.name` an ChurchTools (statt dem veralteten `meetingAt`).

### Intern (Protokolle)

- Regeln des Reiters „Kalender“ ohne Oberfläche und getestet: `shared/protokolle/terminWiederholung.ts` (Arten, „Bis“-Vorgabe = Beginn + `repeatId` Tage, Ordinal „nach Wochentag“),
  `terminFelder.ts` (Fenster → Zusatzfelder der Anfrage, Adresse), `terminVorlagen.ts` (Vorlagen lesen, anwenden, als Vorlage speichern); `Eintrag` in `termine.ts` trägt alle Felder,
  `beginnTagWechseln`. Lesen/Speichern mit Nachlesen: `protokolle/src/terminVorlagenLesen.ts`; Rumpf: `terminRumpf` in `terminAnlegen.ts`. Rechte: `vorlagenKalender` und
  `darfTagsVerwalten` in `shared/ct/kalenderRechte.ts` (Start liefert `vorlagenSchreiben`, `tagsVerwalten`). Der Testnachbau kennt Vorlagen, Tags und den gesendeten Rumpf.
