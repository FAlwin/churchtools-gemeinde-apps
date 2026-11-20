# Anmeldungen

Die Erweiterung „Anmeldungen“ (Kürzel `anmeldungen`, Anleitung `docs/betrieb/ANMELDUNGEN.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w anmeldungen` und
`npm run paket -w anmeldungen`; hochladen unter **Administration → Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-ANM-01 · Startseite: ganze Zeile als Knopf, Status als Etikett

**Das brauchst du:** In der Test-Instanz das Modul **Anmeldungen** mit dem aktuellen Paket, eine Gruppe mit Leitung,
darin ein Entwurf und eine freigegebene Veranstaltung.

**Das muss passieren:** Jede Zeile der Startseite ist selbst der Knopf und endet mit „›“ – es gibt keine Knöpfe „Anzeigen“,
„Ansehen“ oder „Öffnen“ neben den Zeilen. Was zu tun ist, steht als Etikett (blau „wartet auf Freigabe“, rot „3 Zahlungen
offen“). Führt eine Zeile nach ChurchTools, steht klein „in ChurchTools“ dabei, und sie öffnet ChurchTools.

1. Startseite öffnen: Unter **Braucht deine Aufmerksamkeit** auf die Zeile des Entwurfs klicken – die Veranstaltung öffnet sich.
2. Zurück zur Übersicht; auf eine Zeile mit „in ChurchTools“ klicken – die Gruppe in ChurchTools öffnet sich.
3. Unter **Veranstaltungen** auf eine Zeile klicken: Die Veranstaltung öffnet sich; „In ChurchTools“ steht dort oben rechts.
4. **Anstehend · Entwürfe · Vorbei** umschalten: Die Zahlen hinter den Wörtern stimmen mit den Zeilen überein.
5. **Filter** öffnen, eine Gruppe abwählen: Ihre Veranstaltungen verschwinden, am Filter steht „1“.
6. Am Handy (schmal): **Anstehend ⌄** öffnet die Auswahl in einem Fenster; alle Zeilen bleiben antippbar.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `anmeldungen/src/Startseite.tsx`, `anmeldungen/src/Startseite.module.scss`, `ui/bedienung/Etikett.tsx`, `ui/bedienung/KlickZeile.tsx`, `ui/bedienung/AnsichtWahl.tsx`
- **Automatisiert:** teilweise – `Startseite.test.tsx` (Zeilen als Knopf oder Link, Etiketten, Filter, Sammelzeile), `KlickZeile.test.tsx`; das Aussehen am Handy prüft nur dieser Fall
- **Historie:** Ruhige Bedienung B7 (20.11.2026, Entwurf „Restliche Bildschirme“ v2, E24)

</details>

### TF-ANM-02 · Veranstaltung: ein wandernder blauer Knopf

**Das brauchst du:** Ein Entwurf ohne Termin (zum Beispiel über **Neue Veranstaltung** – am Rechner der grüne Knopf im Kopf, am Handy der schwebende grüne Kreis mit **+**) und Recht zum Einrichten.

**Das muss passieren:** Im Band **Nächster Schritt** steht genau **ein** blauer Knopf – immer der nächste fällige Schritt.
Er wandert: Termin wählen → Anmeldung einstellen → (Bezahlung eintragen, wenn etwas kostet) → Freigeben. **Freigeben** steht
erst im Band, wenn es dran ist; vorher liegt es im **⋯**-Menü oben rechts, zusammen mit **Verwalten**. Nach der Freigabe gibt
es oben keinen blauen Knopf mehr. „Bearbeiten“ an den Karten ist blauer Text ohne Rahmen.

1. Entwurf öffnen: blau ist **Termin wählen**. **⋯** öffnen: **Freigeben** und **Verwalten** stehen darin.
2. Termin wählen und speichern: blau ist jetzt **Anmeldung einstellen**.
3. Anmeldebeginn eintragen (und, wenn es etwas kostet, die Bankverbindung): Es ist nur noch **Freigeben** blau, im **⋯**-Menü steht
   nur noch **Verwalten**.
4. **⋯ → Verwalten** öffnet das Fenster, das Menü ist zu. **Freigeben** öffnet die Rückfrage.
5. Eine freigegebene Veranstaltung öffnen: kein blauer Knopf im Kopf; im Bereich **Anmeldungen** ist **Von Hand** der einzige
   farbige Knopf (grün).
6. Ohne Recht zum Einrichten: kein **⋯**-Menü, kein blauer Knopf; „In ChurchTools“ bleibt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `anmeldungen/src/VeranstaltungSeite.tsx`, `anmeldungen/src/schritte.ts`, `anmeldungen/src/Einstieg.tsx`, `ui/bedienung/MehrMenue.tsx`
- **Automatisiert:** ja – `schritte.test.ts` (welcher Schritt ist blau, wo steht „Freigeben“, für jeden Stand) und `VeranstaltungSeite.test.tsx` („Wandernder blauer Knopf“: je Stand genau ein blauer Knopf, jeder Menüpunkt einzeln); von Hand bleibt das Aussehen
- **Historie:** Ruhige Bedienung B7 (20.11.2026, E24)

</details>

### TF-ANM-03 · Anmeldungen: Werkzeuge im ⋯-Menü

**Das brauchst du:** Eine freigegebene Veranstaltung mit mindestens einer Anmeldung.

**Das muss passieren:** In der Leiste über der Tabelle stehen Suche, **Je Anmeldung · Je Person**, der grüne Knopf **Von Hand**
und **⋯**. **Spalten**, **Druckliste** und **Rundmail** liegen im **⋯**-Menü (**Rundmail** nur mit Recht zum Einrichten). Jeder
Eintrag schließt das Menü und öffnet sein Fenster. Ohne Anmeldungen gibt es das Menü nicht.

1. **⋯** öffnen: **Spalten**, **Druckliste**, **Rundmail** – jeweils anklicken, das Fenster öffnet sich, das Menü ist zu.
2. **Von Hand** öffnet das Fenster „Anmeldung von Hand“.
3. Am Handy kommt das Menü als Fenster („Mehr zur Liste“); **Von Hand** ist dort der schwebende grüne Kreis mit **+** unten rechts statt eines grünen Quadrats in der Leiste.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `anmeldungen/src/AnmeldungenReiter.tsx`, `ui/bedienung/MehrMenue.tsx`
- **Automatisiert:** ja – `AnmeldungenReiter.test.tsx` („⋯“-Menü der Liste: jeder Eintrag einzeln, Rechte, leere Liste)
- **Historie:** Ruhige Bedienung B7 (20.11.2026, E24)

</details>
