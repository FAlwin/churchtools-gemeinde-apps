### Neu (Protokolle)

- **Neuer Reiter „Termine“ (W14): Termine aus den Protokollen in den ChurchTools-Kalender eintragen.** Zwischen „To-Dos“ und „Einstellungen“ (am Handy in der Leiste unten)
  sammelt er die **Termin-Bausteine aller Sitzungen** deiner Gruppen – Entwürfe und freigegebene –, nach Datum. Oben **„Noch nicht im Kalender“**; darunter einklappbar
  **„Im Kalender“** (mit Kalender, Zeit und Link nach ChurchTools) und **„Nicht eintragen“**. An jedem Termin: **Eintragen**, im ⋯-Menü **„Im Protokoll zeigen“** (springt
  in die Sitzung zum Punkt) und **„Nicht eintragen“** (blendet ihn aus; „Wieder anzeigen“ holt ihn zurück). Mehrere Gruppen: Filter „Gruppe“. Im Protokoll selbst ändert sich nichts.
- **„Eintragen“ öffnet ein Fenster:** Kalender (nur Kalender, in denen du Termine anlegen darfst; vorausgewählt der Kalender der Gruppe), Titel **ohne** Uhrzeit, Datum,
  **Ganztägig** oder Von–Bis (die Uhrzeit liest es aus dem Text: „16 Uhr“, „19:30 Uhr“, „um 10.30 Uhr“; Ende = eine Stunde später) und Ort. Es werden **keine Einladungen verschickt**.
  Ganztägig geht als Tag an ChurchTools. Steht am selben Tag im gewählten Kalender schon ein Termin mit ähnlichem Namen, ist **„Nur verknüpfen – nichts Neues anlegen“**
  vorgewählt (Alternative „Trotzdem neu anlegen“).
- **Wer in keinem Kalender Termine anlegen darf** (meist Mitglieder), sieht die Liste ohne „Eintragen“ und ohne „Nicht eintragen“, dazu einen Satz, wer eintragen kann.
- **Sicher bei Aussetzern:** Ein Termin gilt erst als „im Kalender“, wenn er in ChurchTools nachgelesen wurde. Antwortet ChurchTools unklar, wird im Kalender nachgesehen –
  gefunden: verknüpft; nicht gefunden: „bitte nachsehen“, nichts wird vermerkt. Scheitert nur der Vermerk, bleibt das Fenster mit **„Nochmal vermerken“** offen (legt nichts doppelt an).
  Das Lesen des Kalenders scheitert → „Eintragen“ bleibt gesperrt, statt doppelt anzulegen. Was aus einem Termin wurde, steht in „Mitarbeit“ der Gruppe (nie im Protokoll,
  nie hart gelöscht); ein Eintrag im Kalender wird von „Nicht eintragen“ nicht überschrieben.

### Intern (Protokolle)

- „Termin anlegen“ (inklusive Nachsehen nach unklarer Antwort) liegt jetzt **einmal** in `protokolle/src/terminAnlegen.ts` – für „Nächste Sitzung festlegen“ (mit Besprechungsanfrage) und
  für den Reiter „Termine“ (ohne); die Regel „in welchen Kalendern darf man anlegen“ steht in `shared/ct/kalenderRechte.ts` und gilt auch in den Anmeldungen.
  Regeln des Reiters: `shared/protokolle/termine.ts` (Sammeln, Uhrzeit, Doppelt, Zeitraum), `shared/protokolle/terminStand.ts` (Stand je Baustein).
