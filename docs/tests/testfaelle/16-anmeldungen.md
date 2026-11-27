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

### TF-ANM-04 · Anmeldungen: Filter über die Spaltenüberschrift

**Das brauchst du:** Eine freigegebene Veranstaltung mit mehreren Anmeldungen, die unterschiedlich geantwortet haben
(mindestens eine Auswahl- oder Ja/Nein-Frage, eine Textfrage), einige bezahlt, einige offen.

**Das muss passieren:** Neben jeder Spaltenüberschrift (außer Name, Nr. und Angemeldet am) steht ein Trichter. Er öffnet
das Filterfenster direkt dort, am Handy als Fenster. Gesetzte Filter stehen als Chips über der Tabelle, darunter „n von m
Anmeldungen“; die Summen zählen nur das Gefilterte. Rundmail und Druckliste nehmen nur die gefilterten Anmeldungen.

1. Trichter bei **Bezahlt** öffnen: Hinter „bezahlt“ und „offen“ steht die Anzahl. „offen“ anhaken, **Anwenden**: Nur die
   offenen bleiben, über der Tabelle „… von …“, der Betrag unten zählt nur sie.
2. Trichter einer Textfrage: **ist leer** → **Anwenden**: Beide Filter gelten zusammen.
3. Chip antippen: Das Fenster geht am Trichter der Spalte auf, die Wahl ist gesetzt. **×** am Chip entfernt nur diesen
   Filter, **Alle Filter entfernen** alle.
4. **Je Person**, Filter auf eine Frage je Person (z. B. Allergien **ist ausgefüllt**): nur diese Personen. Zurück zu
   **Je Anmeldung**: Der Filter bleibt, es stehen die Anmeldungen mit mindestens einer solchen Person da.
5. **⋯**: „Rundmail an diese n“ und „Druckliste (nur diese n)“. Die Rundmail nennt die Filter und hat keine Wahl
   „Alle / Zahlung offen / Warteliste“ (nicht senden!); die Druckliste zeigt nur die passenden Personen.
6. Reiter **Zahlung offen** antippen: Die Filter sind weg.
7. Am Handy (375 px): Das Filterfenster kommt als Fenster in voller Breite, die Chips brechen um, nichts ragt über den Rand.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `anmeldungen/src/AnmeldungenReiter.tsx`, `anmeldungen/src/SpaltenFilterFenster.tsx`, `anmeldungen/src/AnmeldungenTabelle.tsx`, `anmeldungen/src/listenAnsicht.ts`, `shared/anmeldung/tabellenFilter.ts`, `ui/bedienung/SpaltenFilter.tsx`
- **Automatisiert:** ja – `tabellenFilter.test.ts` (jede Filterart, „eine Person erfüllt alle“, Druckliste nur passende Personen, Bereinigen) und `AnmeldungenReiter.test.tsx` („Filter über die Spaltenüberschrift (R2)“); von Hand bleiben die Lage des Fensters am Trichter und das Handy
- **Historie:** R2 (23.11.2026, Entwurf `r2-u3-filter-ansichten-v1`, abgenommen in Klick-Runde 23.11.)

</details>

### TF-ANM-05 · Anmeldungen: eigene Ansichten

**Das brauchst du:** Eine freigegebene Veranstaltung mit mehreren Anmeldungen und Recht zum Bearbeiten; für Schritt 6 ein
zweites Konto ohne dieses Recht.

**Das muss passieren:** Ein Filter wird mit **Als Ansicht speichern** zum Reiter mit blauem Punkt hinter „Abgesagt“ – fürs
ganze Team, auch nach dem Neuladen. In der Ansicht erscheinen nach einer Änderung **Verwerfen** und
**Änderungen speichern**. Über **⋯ → Diese Ansicht** lässt sie sich umbenennen, ihre Spalten wählen, verschieben und
löschen (mit **Rückgängig**).

1. In **Alle** nach einer Antwort filtern, **Als Ansicht speichern**, Name „Küche“ → Reiter **• Küche** mit Zahl, gewählt.
2. Seite neu laden: Der Reiter ist noch da, Antippen zeigt die gefilterten Anmeldungen und den Chip.
3. In der Ansicht einen zweiten Filter setzen: **Verwerfen** stellt den alten Stand her; erneut setzen und
   **Änderungen speichern** – nach dem Neuladen gilt der neue Stand.
4. **⋯ → Ansicht umbenennen**, **Spalten dieser Ansicht** (eine Spalte aus – in „Alle“ bleibt sie), **Ansicht nach links**.
5. **⋯ → Ansicht löschen**: Unter den Reitern steht „Ansicht … gelöscht. Rückgängig“; **Rückgängig** holt sie an ihre Stelle.
6. Ohne Recht: Die Ansichten sind da und filtern; es gibt kein **＋ Ansicht**, kein **Als Ansicht speichern**, im **⋯** nur
   **Spalten dieser Ansicht**, Druckliste und Rundmail.
7. **Wie eine frühere Veranstaltung** von dieser anlegen: Die Kopie hat dieselben Ansichten.
8. Am Handy (375 px): Reiter wischbar, das Fenster „Als Ansicht speichern“ passt, nichts ragt über den Rand.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `anmeldungen/src/AnmeldungenReiter.tsx`, `anmeldungen/src/AnsichtFenster.tsx`, `shared/anmeldung/ansichten.ts`, `shared/anmeldung/formular.ts`, `ui/bedienung/ReiterLeiste.tsx`
- **Automatisiert:** ja – `ansichten.test.ts` (anlegen, Namen, höchstens 12, ändern, Spalten, verschieben, löschen/Rückgängig, Bereinigen, Speichern/Lesen), `einrichten.test.ts` (Kopie) und `AnmeldungenReiter.test.tsx` („Eigene Ansichten (U3)“); von Hand bleiben Neuladen, zweites Konto und Handy
- **Historie:** U3 (23.11.2026, Entwurf `r2-u3-filter-ansichten-v1`)

</details>

### TF-ANM-06 · Veranstaltung: Karte „Nachweise“ einstellen

**Das brauchst du:** Eine Veranstaltung mit Recht zum Bearbeiten, mindestens eine fertig eingerichtete Nachweis-Art
(z. B. „Führungszeugnis“) und im Formular eine Frage mit festen Antworten (z. B. „Bereich“); für Schritt 7 ein zweites
Konto ohne Recht zum Bearbeiten.

**Das muss passieren:** Im Bereich **Vorbereiten** steht die Karte **Nachweise** mit einer Zeile je Art („alle
Angemeldeten“, „nur wenn Bereich ist …“ oder „aus“). Im Fenster **Nachweise · Veranstaltung** lässt sich je Art einstellen,
für wen sie gilt; nach dem Speichern gilt es auch nach dem Neuladen, **Rückgängig** stellt den Stand davor her. Eingetragen
wird erst, wenn eine Vertrauensperson oder ein Admin die Erweiterung öffnet (TF-ANM-07).

1. **Vorbereiten** öffnen: Die Karte **Nachweise** zeigt jede Art, die du sehen darfst, mit „aus“, solange nichts eingestellt ist.
2. **Bearbeiten**, **Führungszeugnis** einschalten, **Alle Angemeldeten** lassen, **Speichern**: Die Karte zeigt „alle Angemeldeten“,
   unter der Meldung steht **Rückgängig**.
3. **Bearbeiten**, **Nur wenn …** wählen: Die erste Frage ist vorgewählt, **Speichern** geht erst, wenn mindestens eine Antwort
   angehakt ist. Antwort wählen, **Fertig**, **Speichern**: Die Karte zeigt „nur wenn Bereich ist …“.
4. Unter beiden Möglichkeiten steht: „Eingetragen wird, sobald eine Vertrauensperson oder ein Admin die Erweiterung öffnet. Wer schon in
   der Nachweis-Gruppe ist, bekommt keine neue Aufforderung.“
5. Im Formular die Frage löschen (oder ausschalten), auf die „Nur wenn“ schaut: Die Karte zeigt in Rot, dass es die Frage nicht mehr gibt –
   und dass bis zur neuen Wahl niemand den Nachweis braucht. Eine Antwort umbenennen: „Nur wenn“ zieht mit.
6. **Wie eine frühere Veranstaltung** von dieser anlegen: Die Kopie hat dieselben Nachweis-Einstellungen.
7. Ohne Recht: Die Karte ist da, hat aber kein **Bearbeiten**.
8. Am Handy (375 px) und im dunklen Modus: Die Karte und das Fenster passen, die Antworten-Auswahl öffnet als Fenster, nichts ragt über den Rand.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `anmeldungen/src/NachweiseKarte.tsx`, `anmeldungen/src/VeranstaltungSeite.tsx`, `anmeldungen/src/nachweisArten.ts`, `shared/anmeldung/nachweisBedarf.ts`, `shared/anmeldung/formular.ts`
- **Automatisiert:** ja – `nachweisBedarf.test.ts` (wer braucht den Nachweis: je Person/Kontakt, Mehrfachauswahl, Ankreuzen, freie Antwort, kaputte Bedingung, Umbenennen, Speichern/Lesen), `NachweiseKarte.test.tsx`, `VeranstaltungSeite.test.tsx` und `einrichten.test.ts` (Kopie, Umbenennen beim Speichern der Frage); von Hand bleiben die Sicht eines Kontos ohne Recht in ChurchTools und das Handy
- **Historie:** N3b (27.11.2026, Entwurf `n-nachweise-v2`, Entscheidungsliste E20, E27 ff.)

</details>

### TF-ANM-07 · Nachweise: Eintragen beim Öffnen

**Das brauchst du:** Eine freigegebene Veranstaltung, die noch läuft, mit eingeschalteter Nachweis-Art – einmal **„Alle
Angemeldeten“**, einmal **„Nur wenn …“** (z. B. „Mitarbeit mit Kindern? ist Ja“); darin zwei aktive Anmeldungen (eine mit
„Ja“, eine mit „Nein“) und eine auf der Warteliste. Dazu ein Konto, das Vertrauensperson der Art ist (kein Admin), und ein
Admin-Konto. Echte Mails gehen raus – nur Testpersonen mit eigenen Adressen nehmen.

**Das muss passieren:** Öffnet die Vertrauensperson die Erweiterung, stehen bei „Alle“ die aktiven Teilnehmer in der
Nachweis-Gruppe (nicht die Wartenden, nicht die Leitung) und bekommen die Aufforderung; unten erscheint leise „2 Personen zum
Nachweis angemeldet.“ „Nur wenn …“ trägt nur ein Admin ein, und nur die passenden. Niemand wird doppelt eingetragen, und wer
von einer Vertrauensperson ausgetragen wurde, kommt für dieselbe Veranstaltung nicht wieder hinein.

1. Als Vertrauensperson die Erweiterung öffnen: unten „2 Personen zum Nachweis angemeldet.“ In ChurchTools stehen beide in der
   Nachweis-Gruppe, die Wartende nicht; beide haben die Mail „Bitte Nachweis vorlegen“ und die Einladung.
2. Seite neu laden: keine Meldung, niemand doppelt, keine neue Mail.
3. Die Veranstaltung mit „Nur wenn …“: Als Vertrauensperson geöffnet, wird dort niemand eingetragen. Als Admin geöffnet: nur
   die Person mit „Ja“.
4. In ChurchTools eine eingetragene Person aus der Nachweis-Gruppe entfernen, Erweiterung neu öffnen: Sie wird für diese
   Veranstaltung nicht wieder eingetragen. Meldet sie sich zu einer neuen Veranstaltung mit derselben Art an, wird sie dort
   wieder eingetragen.
5. Die Erweiterung in zwei Tabs gleichzeitig öffnen: höchstens einmal die Meldung, niemand doppelt.
6. Als Leitung der Veranstaltung (keine Vertrauensperson) **Vorbereiten** öffnen: Die Karte **Nachweise** zeigt die Art mit
   ihrem Namen (nicht „Nachweis-Art Nr. …“), sobald einmal eine Vertrauensperson oder ein Admin die Erweiterung geöffnet hat.
7. Fehlt einer Vertrauensperson das Recht, die Anmeldungen zu sehen (vor dem ersten Öffnen durch einen Admin): unten der
   Hinweis „Dir fehlt noch ein Recht zum Eintragen …“, eingetragen wird nichts.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/anmeldung/nachweisEintragen.ts`, `shared/anmeldung/nachweisStandAblage.ts`, `anmeldungen/src/nachweisEintragen.ts`, `anmeldungen/src/App.tsx`, `anmeldungen/src/nachweise.ts`, `anmeldungen/src/NachweiseKarte.tsx`, `ui/ct/mitglieder.ts`
- **Automatisiert:** ja – `nachweisEintragen.test.ts` (Kern: wer zählt, Merkzettel, Fehlerzweige 403/429/5xx, Obergrenze, Pause mit Fake-Timern; Erweiterung: Fehlerarten aus `fehlerAus`, Meldung, einmal je Seite, Sperre), `nachweisStandAblage.test.ts` (Name und Merkzettel), `nachweise.test.ts` (Recht an der Leiter-Rolle), `NachweiseKarte.test.tsx` (Namen), `mitglieder.test.ts` („schon drin“); echt gelaufen gegen die Test-Instanz (27.11.2026, Skript mit dem Kern des Zweigs). Von Hand bleiben die zwei Tabs, die Meldung im Browser und die Karte als Leitung
- **Historie:** N3c (27.11.2026, Entscheidungsliste E18, E34–E37, Messung M11)

</details>

### TF-ANM-08 · Nachweise: Ampel für die Leitung

**Das brauchst du:** Eine freigegebene Veranstaltung mit eingeschalteter Nachweis-Art (Tage bis zum Beginn: höchstens 42), dazu
fünf Mitarbeitende: einer mit gültigem Nachweis (gültig bis nach dem letzten Tag), einer, dessen Nachweis **vor dem letzten
Tag** endet, einer ohne Nachweis (in der Nachweis-Gruppe, noch nichts eingesehen), einer, der noch nicht in der Nachweis-Gruppe
steht, und einer, der den Nachweis nicht braucht. Ein Konto als **Leitung** der Veranstaltung (keine Vertrauensperson), mit dem
Recht „Anmeldungen sehen“ – und ein zweites Leitungs-Konto ohne dieses Recht. Die Vertrauensperson oder ein Admin muss die
Erweiterung einmal geöffnet haben (schreibt den Stand).

**Das muss passieren:** Im Reiter **Anmeldungen** steht eine Spalte mit dem Namen der Art: grün „gültig bis MM/JJJJ“, blau „läuft
vor Ende ab“, rot „fehlt“, grau „noch nicht angefordert“, bei dem Fünften leise „nicht nötig“. Nie das Ergebnis der Einsicht.
Auf der Startseite steht bei „Braucht deine Aufmerksamkeit“ „3 Personen ohne gültigen Nachweis“ (nur für die Leitung).

1. Reiter **Anmeldungen**, **Je Person**: die fünf Zustände wie oben. Mit der Maus über „läuft vor Ende ab“: der Tag steht dabei.
2. Über den Trichter im Spaltenkopf nach „fehlt“ filtern: nur diese Person bleibt. Als Ansicht speichern, Seite neu laden: die
   Ansicht filtert noch.
3. Auf den Spaltenkopf tippen: sortiert, wer Aufmerksamkeit braucht, zuerst. **Spalten** → die Spalte aus- und wieder einblenden.
4. **Je Anmeldung**: die Spalte zeigt den schlechtesten Wert der Personen einer Anmeldung.
5. Das Konto ohne „Anmeldungen sehen“: Die Spalte sagt **„Stand nicht lesbar“** – nie „fehlt“; auf der Startseite kein Hinweis.
6. Startseite: Die Zeile „n Personen ohne gültigen Nachweis“ öffnet die Veranstaltung. Eine Veranstaltung, die erst in mehr als
   42 Tagen beginnt, zeigt keinen Hinweis; eine vergangene ebenfalls nicht.
7. Die Druckliste enthält die Spalte nicht.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/anmeldung/nachweisAmpel.ts`, `shared/anmeldung/nachweisAmpelLage.ts`, `shared/anmeldung/tabelle.ts`, `shared/anmeldung/tabellenFilter.ts`, `shared/anmeldung/nachweisStandAblage.ts`, `anmeldungen/src/AnmeldungenReiter.tsx`, `anmeldungen/src/nachweisHinweis.ts`, `anmeldungen/src/veranstaltungen.ts`, `anmeldungen/src/Startseite.tsx`
- **Automatisiert:** ja – `nachweisAmpel.test.ts` (Regel, Grenzen, Erzeuger), `nachweisAmpelLage.test.ts` (Lage, 42/43 Tage), `nachweisSpalte.test.ts` (Katalog, Zellen, Sortierung, Filter, Ansichten), `nachweisHinweis.test.ts`, `veranstaltungen.test.ts`, `AnmeldungenReiter.nachweise.test.tsx`, `nachweisAblageFuerLeitung.test.ts`, `Startseite.test.tsx`; im Browser mit der Demo (`?demo=vertrauen`) durchgeklickt. Von Hand bleibt der Weg gegen echtes ChurchTools (Rechte, Stand aus der Ablage)
- **Historie:** N3d (27.11.2026, Entscheidungsliste E24, E25, E38–E43)

</details>

### TF-ANM-09 · Formular: Liste mit Zeilen im Baukasten

**Das brauchst du:** Die Erweiterung in der Entwicklung (`npm run dev`, Demo `?demo`) – bis F6b gibt es den Baustein nur dort.
Eine Veranstaltung, deren Formular du bearbeiten darfst (Demo: „Worship-Workshop“, dort steht schon „Was bringst du privat
mit?“).

**Das muss passieren:** Unter „Eigene Fragen“ gibt es die Kachel **„Liste mit Zeilen“**. Im Feld lassen sich Spalten benennen,
als Text/Zahl/Auswahl einstellen, verschieben und löschen; eine Zahl-Spalte bekommt Einheit und „Summe zeigen“ (immer nur
eine). Die Vorschau darunter zeigt, wie Gäste die Liste sehen. Am Computer ist sie eine Tabelle, am Handy eine Karte je Eintrag.

1. Kachel antippen: Die Liste kommt mit „Was“ (Text) und „Anzahl“ (Zahl), höchstens 10 Zeilen.
2. „+ Spalte hinzufügen“ dreimal: „Neue Spalte“, „Neue Spalte 2“, … – nach fünf Spalten steht „höchstens 5 Spalten“.
3. Bei einer zweiten Zahl-Spalte „Summe zeigen“ anhaken: der Haken der ersten verschwindet.
4. Zwei Spalten gleich benennen: roter Hinweis am Feld, nichts wird gespeichert; umbenennen → „… gespeichert“.
5. **Vorschau**: In die Liste tippen, eine Zeile nur halb ausfüllen, **Verbindlich anmelden**: Die halbe Zeile ist rot markiert,
   darunter „Zeile 1: … fehlt“; eine leere Zeile hält nichts auf. Die Summe zählt nur vollständige Zeilen.
6. Fenster schmal (375 px): je Eintrag eine Karte mit beschrifteten Feldern, Zahlen zu zweit nebeneinander.
7. Gebaute Erweiterung (Test-ZIP): **keine** Kachel „Liste mit Zeilen“ und kein Fragetyp dieses Namens.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/anmeldung/zeilenListe.ts`, `shared/anmeldung/formular.ts`, `anmeldungen/src/ListeBearbeiten.tsx`, `anmeldungen/src/bausteinFrei.ts`, `anmeldungen/src/formularFelder.ts`, `ui/anmeldeformular/ListeEingabe.tsx`
- **Automatisiert:** ja – `zeilenListe.test.ts` (Regel), `formular.test.ts` (Prüfung, Ablage, Schema), `einrichten.test.ts` (Spalten in ChurchTools), `senden.test.ts` (Absenden gesperrt bis F6b), `Baukasten.test.tsx` (Kachel, Fragetyp, Bearbeiten, gebaute Erweiterung), `ListeEingabe.test.tsx`; im Browser mit der Demo durchgeklickt (Computer, 375 px, hell/dunkel). Von Hand bleibt der Weg gegen echtes ChurchTools – mit F6b
- **Historie:** F6a (27.11.2026, Messung M9, Entscheidungsliste E44–E50)

</details>
