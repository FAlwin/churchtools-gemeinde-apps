# Abwesenheiten (eigene Abwesenheiten in ChurchTools)

Der Tab „Abwesenheiten" (#177) schreibt **echte Abwesenheiten in ChurchTools**. Alle Fälle deshalb auf
**musik-test** mit einem Konto durchspielen, dessen Einträge man hinterher in ChurchTools nachsehen
und aufräumen darf. Aufbau seit dem 19.09.2026 (Entwurfsrunde 8): Zeitraum (seit 28.10.2026 der Zeitraum-Knopf
wie im Dienstplaner, vorher eine Monatsleiste), ein Abhakfeld je Termin, **Speichern-Leiste** – nichts wird ohne „Speichern" geschrieben.

### TF-VERF-01 · Bei Terminen abhaken, speichern, zurücknehmen

**Das brauchst du:** Ein Konto, das aktives Mitglied einer unter „Einstellungen → Verwaltung → Anmerkungen →
Gruppen-Zuweisung" gewählten Gruppe ist (ECG: Musikteam). Zugriff auf ChurchTools, um nachzusehen.

**Das muss passieren:** Der Tab **Abwesenheiten** ist da (Person mit Schrägstrich). Ein Haken bei einem
Termin ist nur **vorgemerkt** (blauer Ring) – erst **Speichern** legt in ChurchTools **je Termin**
eine Abwesenheit mit dessen **Uhrzeit** und dem Kommentar `[Musikteam]` an, alle Häkchen auf einmal
(seit 22.09.2026; vorher ganztägig je Tag). Ein zweiter Tipp nimmt einen Haken zurück.

1. Anmelden, unten auf **Abwesenheiten**. Beim ersten Öffnen erscheint die Einführung (vier Blasen, drei ohne Termin-Arten) –
   schließen. Oben die **Werkzeugzeile** (seit B4, alles in EINER Zeile): links der Schalter **Termine | Einträge**
   (an „Einträge“ ein blau gefüllter Kreis mit der Zahl), in der Mitte der **Zeitraum** als ein Rahmen ‹ „28.10. – 24.11.2026 · 6 Termine ·
   ab heute“ › und rechts – wenn es mehrere Termin-Arten gibt – **Filter** (mit dem Wort), am iPad daneben grün **+ Zeitraum eintragen**.
   Alles sieht aus wie im Dienstplaner. ‹ geht ab heute nicht (Vergangenes steht unter „Einträge → Früher“), › zeigt die nächsten vier Wochen.
2. Beim nächsten Gottesdienst das Kästchen **Abwesend** antippen: Haken rot, blauer Ring, die
   Datumskachel wird rot. Unten erscheint die Leiste **„Verwerfen · 1 Änderung vorgemerkt ·
   Speichern"**, das Plus ist weg. **In ChurchTools steht noch nichts.**
3. Ein zweites Kästchen antippen (2 Änderungen), dann beim ersten den Haken wieder wegnehmen (1
   Änderung). **Verwerfen** → Leiste weg, alle Haken wie vorher.
4. Ein Kästchen antippen, **Speichern** → Meldung „1 Änderung gespeichert – steht jetzt in
   ChurchTools.", der Ring ist weg, der Haken bleibt rot. Das Plus ist wieder da.
5. In ChurchTools: Personen → dein Profil → Abwesenheiten. Der Eintrag ist da, Grund „Abwesend",
   Kommentar **`[Musikteam]`**.
6. Zurück in der App: den Haken wegnehmen → Leiste, **Speichern** → in ChurchTools ist der Eintrag weg.
7. **Zwei auf einmal:** zwei Termine abhaken, einmal Speichern → Meldung „2 Änderungen gespeichert",
   in ChurchTools zwei Einträge. Dann beide wieder weg, Speichern.
8. **Unter „Termine" fehlt Vergangenes:** Auch der laufende Monat zeigt nur Termine ab heute.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/Availability.tsx`, `ui/bedienung/ZeitraumKnopf.tsx`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx` (vorgemerkt statt geschrieben, zweiter Tipp, Verwerfen, kein Plus während der Vormerkung, Fehler behält die Vormerkung), `client/src/hooks/useAvailability.test.tsx` (erst anlegen, dann löschen, nacheinander; nach Fehlschlag neu holen), `server/src/services/absences.test.ts`; von Hand bleibt, dass ChurchTools die Einträge wirklich anlegt und der Grund stimmt (`CHURCHTOOLS_ABSENCE_REASON_ID`)
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-02 · Ein Termin in einem Zeitraum: Rückfrage statt stillem Löschen

**Das brauchst du:** Wie TF-VERF-01, plus eine Abwesenheit **über mehrere Tage**, die du **direkt in
ChurchTools** anlegst – Grund **„Urlaub"**, Kommentar „Test-Urlaub" (**ohne** `[Musikteam]`), über einen
kommenden Termin.

**Das muss passieren:** Der Termin im Urlaub hat den Haken (Kachel grau, Unterzeile „Urlaub · Mi,
14.10. – Di, 20.10."). Den Haken wegzunehmen fragt nach: **Zeitraum löschen** (vorgemerkt) oder
**Zeitraum anpassen** (Fenster) oder Abbrechen. Beim Anpassen bleibt der Eintrag **Urlaub** und
bekommt **keinen** Marker.

1. In ChurchTools den Urlaub anlegen. In der App **Abwesenheiten** öffnen (nach unten ziehen zum
   Aktualisieren).
2. Beim Termin im Urlaub das Kästchen antippen → Fenster **„Teil eines Zeitraums"** mit dem Satz
   „… gehört zu Urlaub, Mi, 14.10. – Di, 20.10. (Test-Urlaub)". **Abbrechen** → nichts vorgemerkt.
3. Erneut antippen → **Zeitraum anpassen**: Das Fenster „Abwesenheit ändern" zeigt Von/Bis, Kommentar
   und **Grund „Urlaub"**. **Bis** um einen Tag kürzen, **Speichern** → „Geändert." In ChurchTools steht
   genau **ein** Eintrag mit den neuen Daten, Grund weiterhin **Urlaub**, ohne Marker.
4. Erneut antippen → **Zeitraum löschen**: Fenster zu, der Haken ist weg, Leiste „1 Änderung
   vorgemerkt". Ein weiterer Tipp auf das Kästchen nimmt die Löschung **ohne Rückfrage** zurück.
5. Noch einmal löschen vormerken, **Speichern** → in ChurchTools ist der Urlaub weg.
6. **Gegenprobe:** Ein eigener Eintages-Eintrag (TF-VERF-01) fragt beim Wegnehmen **nicht** nach.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `ui/abwesenheiten/ZeitraumFrage.tsx`, `client/src/pages/Availability.tsx`, `ui/abwesenheiten/AbsenceSheet.tsx`, `server/src/services/absences.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx` (Rückfrage, löschen vormerken, zurücknehmen, anpassen öffnet das Fenster), `server/src/services/absences.test.ts` (Grund und fehlender Marker bleiben beim Ändern), `server/src/services/absenceGrund.test.ts`; von Hand bleibt der echte ChurchTools-Eintrag
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-03 · Ohne Gruppen-Mitgliedschaft kein Tab

**Das brauchst du:** Ein Konto, das in **keiner** der gewählten Gruppen aktives Mitglied ist (oder:
Admin leert die Gruppen-Zuweisung).

**Das muss passieren:** Unten gibt es **keinen** Tab „Abwesenheiten" – nur Termine, Lieder, Einstellungen. War
der Tab vorher geöffnet, landet man nach dem Neuladen auf „Termine", nicht auf einer leeren Seite.

1. Mit diesem Konto anmelden, Tab-Leiste ansehen.
2. Gegenprobe mit einem Musikteam-Konto: Tab ist da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/ctCapabilities.ts`, `client/src/App.tsx`, `client/src/components/TabBar.tsx`
- **Automatisiert:** teilweise – `server/src/services/churchtools.capabilities.test.ts` (`computeAvailabilityAllowed`); der Rückfall auf „Termine" ist Handarbeit
- **Historie:** #177

</details>

### TF-VERF-04 · Zeitraum über das Plus eintragen, unter „Einträge" ändern und löschen

**Das brauchst du:** Wie TF-VERF-01.

**Das muss passieren:** Das Plus öffnet **„Zeitraum eintragen"** direkt mit Schnellwahl – am Handy das runde Plus
unten rechts, am iPad/Rechner der grüne Knopf **„+ Zeitraum eintragen“** oben rechts (wie „+ Gruppe erstellen“ in
ChurchTools); solange Häkchen vorgemerkt sind, gibt es beides nicht. Nach dem Eintragen
steht der Zeitraum unter **Einträge → Anstehend** mit den Terminen, die er trifft. Ein Tipp auf die
Zeile öffnet „Abwesenheit ändern"; nach dem Speichern steht in ChurchTools **genau ein** Eintrag mit
den neuen Werten – der alte ist weg, der Marker `[Musikteam]` geblieben (so schreibt es der NAS-Server; in ChurchTools
siehe TF-VERF-09). Alle Einträge sehen gleich aus – seit 04.11.2026 gibt es kein graues „in ChurchTools eingetragen“
mehr.

1. Am Handy unten rechts auf das **Plus**, am Rechner oben auf **„+ Zeitraum eintragen“** → Fenster „Zeitraum
   eintragen", Von = nächster Termin. **„1 Woche"**
   antippen: Von/Bis springen auf sieben Tage, der Knopf heißt „Eintragen (7 Tage)". **Eintragen** →
   Meldung „Eingetragen …". Gegenprobe: **„Wochenende"** trifft Samstag+Sonntag.
2. Oben auf **Einträge**: Unter **Anstehend (n)** steht der Zeitraum, Unterzeile „trifft So, …" mit den
   Terminen darin. Der Zähler am Schalter stimmt. Unter „Termine" haben die getroffenen Termine den
   Haken, Unterzeile mit Zeitraum.
3. Die Zeile antippen → „Abwesenheit ändern" mit Von, Bis, Kommentar, Grund. **Bis** zwei Tage nach
   hinten, Kommentar ändern, **Speichern** → „Geändert.", die Zeile zeigt den neuen Zeitraum.
4. In ChurchTools nachsehen: **ein** Eintrag mit den neuen Daten und Kommentar `[Musikteam] …` –
   kein zweiter, kein alter.
5. Die Zeile erneut antippen → **Löschen** → im Fenster die Rückfrage **„Abwesenheit löschen?"** mit Grund und
   Zeitraum; **Behalten** bricht ab. Noch einmal **Löschen** → **Ja, löschen** → „Gelöscht.", in ChurchTools ist
   der Eintrag weg. Seit 04.11.2026 fragt das **jeder** Eintrag – auch einer aus der App (vorher nur einer, der
   direkt in ChurchTools gemacht wurde).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `ui/abwesenheiten/AbsenceSheet.tsx`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `client/src/pages/Availability.tsx`
- **Automatisiert:** teilweise – `server/src/services/absences.test.ts` (Reihenfolge anlegen→löschen, 403, 409, Fehlschlag beim Aufräumen), `ui/abwesenheiten/AbsenceSheet.test.tsx`, `client/src/pages/Availability.test.tsx` (Plus mit nächstem Termin, Einträge nach Monat mit „trifft", Löschen); von Hand bleibt, dass in ChurchTools wirklich nur ein Eintrag übrig bleibt
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-05 · Zeitraum wählen, Früheres ansehen

**Das brauchst du:** Wie TF-VERF-01, dazu eine Abwesenheit in der Vergangenheit (in ChurchTools ein
Datum vor heute eintragen – das lässt die App nicht zu).

**Das muss passieren:** Der **Zeitraum-Knopf** ist derselbe wie in Dienstplaner › Planen (seit 28.10.2026, vorher
Monats-Kapseln). Gezeigt wird nur nach vorn; beim Öffnen „ab heute“ (die nächsten vier Wochen). Vergangenes steht
unter **Einträge → Früher**, nur zum Ansehen.

1. Der Knopf zeigt die Spanne der nächsten vier Wochen und darunter „n Termine · ab heute“. Antippen → Menü: **Ab
   heute** (die nächsten 4 Wochen), darunter **Monat** mit Jahr ‹ › und zwölf Monatsfeldern (der laufende mit Punkt,
   die vergangenen gesperrt), darunter **Eigener Zeitraum** von–bis mit „Anzeigen“. Tipp daneben oder Escape schließt
   es.
2. Monatsfeld **Nov** → Knopf „November 2026“, darunter die Überschrift „November 2026“ und seine Termine.
3. **Eigener Zeitraum** über zwei Monate → je Monat eine Überschrift mit eigener Zahl. Ein Zeitraum ohne Termine sagt
   „Kein Termin in diesem Zeitraum.“ Ein Zeitraum weit über ein Jahr hinaus lädt kurz nach und zeigt dann seine
   Termine.
4. **Einträge → Früher (n):** Der vergangene Eintrag steht dort, blass. Antippen → Fenster
   „Vergangene Abwesenheit", Felder gesperrt, kein Speichern, kein Löschen; geschlossen wird mit dem X.
5. **Anstehend** zeigt ihn nicht; unter „Termine" gibt es nichts aus der Vergangenheit.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/bedienung/ZeitraumKnopf.tsx`, `shared/ct/zeitraum.ts`, `shared/ct/monate.ts`, `client/src/pages/Availability.tsx`, `ui/abwesenheiten/AbsenceSheet.tsx`, `server/src/services/absences.ts`
- **Automatisiert:** teilweise – `ui/bedienung/ZeitraumKnopf.test.tsx`, `shared/ct/zeitraum.test.ts`, `shared/ct/monate.test.ts`, `client/src/pages/Availability.test.tsx` (ab heute vier Wochen, Monatsfelder mit gesperrter Vergangenheit, eigener Zeitraum über zwei Monate, leerer Zeitraum, Nachladen über ein Jahr hinaus, Früher nur lesbar), `server/src/services/absences.test.ts` (Fenster bis zu einem Tag, höchstens ein Jahr); von Hand bleibt die Bedienung am Gerät
- **Historie:** #177 (Runde 8, 19.09.2026); Zeitraum-Knopf statt Monatsleiste 28.10.2026 (Entwurf A, Alwin); Monatsfelder statt „Dieser/Nächster Monat“ E9-3 (05.11.2026)

</details>

### TF-VERF-06 · Termine nach Art filtern (mit Admin-Pflege)

**Das brauchst du:** Ein Admin-Konto und ein Konto mit dem Tab „Abwesenheiten". Einen Monat, in dem
Termine mit verschiedenen Namen liegen (z. B. „Gottesdienst", „Gebetsabend", „Probe").

**Das muss passieren:** Der Admin legt die Arten fest, im **Filter**-Menü (derselbe Knopf wie im Dienstplaner,
seit 28.10.2026) steht je Art ein Häkchen, Liste und Zahl folgen den Häkchen, und beim nächsten Öffnen steht der
Filter noch so.

1. **Als Admin:** Einstellungen → Verwaltung → **„Abwesenheiten: Termin-Arten"**. Zwei Arten anlegen:
   Name „Gottesdienst", Suchwort „Gottesdienst"; Name „Gebetsabend", Suchwort „Gebet". Speichern.
   Die Reihe zeigt „2 Arten".
2. Tab „Abwesenheiten" → „Termine". Rechts steht der Knopf **„Filter“**. Antippen → Menü „Veranstaltungen“ mit
   Häkchen bei „Gottesdienst“, „Gebetsabend“ und – falls es Termine mit anderem Namen gibt – **„Sonstige“**; alle
   angehakt.
3. **„Gebetsabend“** abhaken: Gebetsabende verschwinden, die Zahl am Zeitraum-Knopf passt, der Filter-Knopf ist blau
   getönt und trägt eine **1**.
4. Zusätzlich **„Sonstige“** abhaken: Nur noch Gottesdienste (auch „Gottesdienst mit Abendmahl“), der Knopf trägt
   **2**. Beide wieder anhaken → alles ist zu sehen, keine Zahl.
5. Alle abhaken → „Kein Termin in diesem Zeitraum.“ – der Filter ist sichtbar aktiv.
6. **Häkchen bleibt:** Einen Gottesdienst als abwesend abhaken (Leiste „Speichern" erscheint), dann „Gottesdienst“
   im Filter abhaken: Die Leiste bleibt. Wieder anhaken: Der Haken „Abwesend“ steht noch.
7. **Merken:** „Gebetsabend“ abhaken, App schließen und neu öffnen → der Filter steht noch so.
   **Alte Wahl:** Wer vor dem 28.10.2026 „nur Gottesdienst“ gewählt hatte, sieht beim ersten Öffnen Gottesdienst
   angehakt und alle anderen Arten abgehakt.
8. **Ohne Arten:** Der Admin löscht alle Arten und speichert. Im Tab gibt es den Filter-Knopf **nicht**.
9. **Halbe Zeile:** Im Admin-Fenster eine Art nur mit Namen anlegen und speichern → Meldung, nichts
   gespeichert.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Availability.tsx`, `ui/abwesenheiten/terminFilter.ts`, `ui/bedienung/FilterKnopf.tsx`, `client/src/components/TerminArtenManager.tsx`, `client/src/pages/Settings.tsx`, `client/src/components/VerwaltungFenster.tsx`, `client/src/components/VerwaltungZeilen.tsx`, `client/src/hooks/useVerwaltung.ts`, `client/src/utils/devicePrefs.ts`, `server/src/services/siteConfig.ts`
- **Automatisiert:** überwiegend – `ui/abwesenheiten/terminFilter.test.ts` (Suchwort, Reihenfolge, Sonstige, Ausblenden, Umrechnen der alten Wahl), `ui/bedienung/FilterKnopf.test.tsx`, `client/src/pages/Availability.test.tsx` (Häkchen, Zahl am Knopf, mehrere ausblenden, Sonstige, Merken, alte Wahl umgerechnet, Häkchen übersteht den Wechsel, kein Filter ohne Arten), `client/src/components/TerminArtenManager.test.tsx` (trimmen, halbe Zeile, löschen), `server/src/services/siteConfig.test.ts` (Schema, Rundlauf, doppelte IDs); von Hand bleibt der Weg über den echten Admin-Bereich
- **Historie:** #400 (20.09.2026), Wunsch Alwin; erster Bau nach Kalender verworfen (bei der ECG ein Kalender für alles); Filter-Knopf mit Häkchen wie im Dienstplaner statt Kapseln „eins oder alles“ 28.10.2026

</details>

### TF-VERF-07 · Zwei Termine an einem Tag einzeln abhaken

**Das brauchst du:** Einen Tag mit **zwei** Terminen in ChurchTools (z. B. Gottesdienst 10:00 und
Jugendtreff 16:00) und Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Die beiden Termine sind unabhängig. Ein Haken am Vormittagstermin lässt den
Nachmittag frei – in ChurchTools steht eine Abwesenheit **mit Uhrzeit**, nicht für den ganzen Tag
(Wunsch Alwin, 22.09.2026: „manchmal hab ich morgens keine Zeit kann aber nachmittags").

1. Tab **Abwesenheiten**, den Monat mit den beiden Terminen wählen. Beide stehen untereinander, die
   Datumskachel zeigt links die Uhrzeit.
2. Beim **ersten** Termin **Abwesend** abhaken → nur dieser bekommt den Haken, der zweite bleibt
   leer. Unten die Leiste, **Speichern**.
3. Nach dem Speichern: Der erste Termin ist rot, der zweite **unverändert frei**.
4. In ChurchTools nachsehen (Personen → dein Profil → Abwesenheiten): Der Eintrag trägt die
   **Uhrzeit des Termins**, nicht „ganztägig".
5. Jetzt auch den **zweiten** Termin abhaken und speichern → **zwei** Einträge am selben Tag.
6. Unter **Einträge** stehen beide getrennt, jeder mit seiner Uhrzeit („Abwesend · 10:00 – 12:00").
7. **Ganztägig bleibt ganztägig:** Über das **Plus** einen Zeitraum eintragen, der diesen Tag
   enthält → **beide** Termine zeigen den Haken (ein Urlaub gilt für den ganzen Tag).
8. Einen Eintrag mit Uhrzeit antippen, nur den **Kommentar** ändern, speichern → die Uhrzeit bleibt
   erhalten, der zweite Termin ist weiterhin frei.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/absences/index.ts`, `client/src/pages/Availability.tsx`, `ui/abwesenheiten/absenceDatum.ts`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/services/ctWrite.ts`, `server/src/controllers/absencesController.ts`
- **Automatisiert:** teilweise – `ui/abwesenheiten/absenceDatum.test.ts` (Fenster trennt Vormittag/Nachmittag, ganztägig deckt beides, Grenzen offen), `client/src/pages/Availability.test.tsx` (Haken lässt den zweiten Termin frei), `server/src/services/absences.test.ts` (Doppel-Erkennung mit Fenster, Uhrzeit überlebt eine Änderung); von Hand bleibt, dass ChurchTools die Uhrzeit wirklich speichert und anzeigt
- **Historie:** Alwin 22.09.2026 („das muss in der logik geändert werden"). Am 24.09.2026 lehnte ChurchTools jeden Eintrag mit Uhrzeit ab (Schritt 2 → Fehlermeldung), ohne neue Versionsnummer – seitdem gehen die Tage als Zeitpunkte hinaus (`fuerChurchTools`). **Schritt 4 ist deshalb der wichtigste:** Er bemerkt, wenn ChurchTools sein Verhalten wieder ändert.

</details>

### TF-VERF-08 · Ein Termin kurz nach Mitternacht steht am richtigen Tag

**Das brauchst du:** Einen Termin in ChurchTools, der **zwischen 0 und 2 Uhr** beginnt (z. B. eine
Silvester-Andacht am 01.01. um 0:30), und Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Der Termin steht an **seinem** Tag – nicht am Vortag. ChurchTools rechnet
Zeiten intern in UTC, und 0:30 Uhr deutscher Zeit ist dort noch der Vortag (#414).

1. Tab **Termine** → der Termin steht am **01.01.**, nicht am 31.12.
2. Tab **Abwesenheiten**, den Monat wählen → der Termin steht ebenfalls am **01.01.**
3. **Abwesend** abhaken, **Speichern** → keine Fehlermeldung, der Termin ist rot.
4. In ChurchTools nachsehen (Personen → dein Profil → Abwesenheiten): Der Eintrag steht am **01.01.**
   mit der Uhrzeit des Termins.
5. Die App neu laden → der Haken ist noch da (Eintrag und Termin passen zusammen).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/utils/isoTag.ts`, `server/src/config.ts`, `server/src/services/absences.ts`, `server/src/services/ctWrite.ts`, `shared/ct/mapEvent.ts`, `server/src/services/setlistBuilder.ts`
- **Automatisiert:** überwiegend – `server/src/utils/isoTag.test.ts` (Winter-/Sommerzeit, 23:59, Versatz, andere Zeitzone), `server/src/services/absences.test.ts` (0:30 Uhr gehört zum deutschen Tag, Termin über Mitternacht endet am Folgetag), `server/src/config.zeitzone.test.ts`; von Hand bleibt, dass ChurchTools den Eintrag am selben Tag anlegt
- **Historie:** #414 (24.09.2026). An der Test-Instanz gemessen: ChurchTools legt eine Abwesenheit ab `2026-12-03T23:30:00Z` selbst am **04.12.** an – es rechnet also in deutscher Zeit, genau wie die App jetzt

</details>

### TF-VERF-09 · Abwesenheiten in der Musik-App in ChurchTools (Erweiterung)

**Das brauchst du:** Die Musik-App als Erweiterung in der **Test-Instanz**, ein Konto ohne Admin-Recht, das die
Musik-App öffnen darf (z. B. Spike – auch ohne Musikteam), und Zugriff auf ChurchTools zum Nachsehen (Personen →
Profil → Abwesenheiten).

**Das muss passieren:** Der Reiter **„Abwesenheiten"** ist da (bis E7-2b fehlte er in der Erweiterung) und arbeitet
direkt mit ChurchTools – ohne den NAS-Server. Neue Einträge tragen **kein** `[Musikteam]`; Ändern bleibt **derselbe**
Eintrag; Löschen fragt immer nach.

1. Musik-App in ChurchTools öffnen → unten der Reiter **Abwesenheiten** – für **jeden**, der die App öffnet, auch ohne
   Musikteam-Gruppe (Rechtekonzept E2, 04.11.2026; auf dem NAS weiter nur das Musikteam).
2. Einen Termin **Abwesend** abhaken, **Speichern** → „1 Änderung gespeichert …". In ChurchTools: ein Eintrag mit
   der **Uhrzeit des Termins**, Grund **Abwesend**, Kommentar **leer** (kein `[Musikteam]`).
3. Denselben Termin noch einmal in einem zweiten Tab abhaken und speichern → in ChurchTools steht **kein zweiter**
   Eintrag.
4. Über **+ Zeitraum eintragen** eine Woche mit Grund **Urlaub** eintragen. Unter **Einträge** antippen, **Bis**
   verlängern und den Kommentar ändern → **Speichern**. In ChurchTools: derselbe Eintrag (gleiche Stelle in der Liste),
   neue Daten, Grund **Urlaub** geblieben.
5. Einen Eintrag, der direkt in ChurchTools gemacht wurde, unter **Einträge** öffnen → er sieht aus wie alle anderen
   (kein Grau). **Löschen** → Rückfrage → **Ja, löschen** → in ChurchTools ist er weg.
6. Aufräumen: die Einträge aus Schritt 2–4 löschen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/absences/abwesenheiten.ts`, `ui/ct/abwesenheitPort.ts`, `ui/abwesenheiten/ctDienst.ts`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `client/src/services/availability.ts`, `client/src/services/ctLesen.ts`
- **Automatisiert:** überwiegend – `shared/absences/abwesenheiten.test.ts` (Nachbau von ChurchTools wie gemessen: Doppel, PUT ersetzt ganz, Tage + Uhrzeit = 400, Lesefenster einen Tag weiter, DELETE ohne Wirkung), `ui/abwesenheiten/ctDienst.test.ts` (Meldungen, vorgewählter Grund, Termine), `client/src/services/ctTeilen.test.ts` (Recht wie im Server); von Hand bleibt, dass ChurchTools die Einträge wirklich so zeigt
- **Historie:** Dienstplaner E7-2a/E7-2b (04.11.2026): nur noch die Erweiterung zählt, kein Kennzeichen mehr

</details>

### TF-VERF-10 · Abwesenheiten im Dienstplaner, mit den eigenen Diensten

**Das brauchst du:** Den Dienstplaner in der **Test-Instanz**, ein Konto ohne Admin-Recht mit mindestens einem
kommenden Dienst (eingeteilt) und einer offenen Anfrage (z. B. Spike), Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Der Reiter **„Wann kann ich?"** (bis E5c-1c „Abwesenheiten", Adresse `#/abwesenheiten` bleibt) zeigt
dieselbe Seite wie die Musik-App (Termine | Einträge, Zeitraum, Filter, Speichern-Leiste, Fenster) – für jeden, ohne eigenes
Recht. Statt des Hakens hat jeder Termin **Ja · Vielleicht · Nein**, „Nein" ist die Abwesenheit (Ja/Vielleicht: TF-VERF-11).
Unter jedem Termin stehen die eigenen Dienste; wer bei einem Termin mit Dienst „Nein" wählt, sieht in Rot, dass er auch den
Dienst absagen soll.

1. Dienstplaner öffnen → Reiter **Wann kann ich?** (am Handy unten, am Rechner oben). Statt „Hier trägst du bald ein …"
   steht die Terminliste ab heute, darüber **eine Werkzeugzeile** (seit B4): links **Termine | Einträge** (Merker an „Einträge“),
   in der Mitte der **Zeitraum** mit ‹ ›, rechts – wenn eine Veranstaltung mehrfach vorkommt – **Filter** und der grüne Knopf
   **+ Zeitraum eintragen**. Unter „Einträge“ fehlen Zeitraum und Filter, der grüne Knopf bleibt. Eine leere Notiz heißt leise
   **+ Notiz**, eine vorhandene zeigt nur ihren Text. **Handy:** blauer Knopf **Termine ⌄** (Blatt: Termine · Einträge (n)), rechts
   der Filter mit Rahmen, darunter der Zeitraum über die ganze Breite, statt des grünen Knopfs das runde Plus.
2. Unter dem Termin mit Dienst: **„Du bist eingeteilt: …"**, unter dem mit Anfrage **„Angefragt: …"**.
3. Beim Termin mit Dienst **Nein** wählen → die Zeile darunter wird rot: **„… – bitte auch den Dienst absagen"**.
   **Speichern** → in ChurchTools ein Eintrag mit der Uhrzeit des Termins, ohne Kennzeichen. Der Dienst selbst bleibt
   (absagen geht über „Dienste" bzw. die Startseite).
4. Über **+ Zeitraum eintragen** eine Woche eintragen, unter **Einträge** ändern und löschen (Rückfrage) – wie TF-VERF-04.
5. Startseite: die Karte **„Wann kann ich?"** führt in diesen Reiter.
6. Aufräumen: Einträge aus 3–4 löschen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `dienstplaner/src/Abwesenheiten.tsx`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `ui/abwesenheiten/ctDienst.ts`, `shared/dienstplan/meineDienste.ts`, `dienstplaner/src/ladeBeiwerk.ts`
- **Automatisiert:** überwiegend – `dienstplaner/src/Abwesenheiten.test.tsx` (Termine ab heute, Dienst-Hinweis, rote Warnung, Speichern mit Fenster, Neuladen, Filter, Fehler), `dienstplaner/src/Abwesenheiten.werkzeug.test.tsx` (Werkzeugzeile: Reihenfolge, Merker, ‹ ›, Einträge ohne Zeitraum, Handy), `ui/bedienung/ZeitraumLeiste.test.tsx`, `ui/bedienung/AnsichtWahl.test.tsx`, `shared/dienstplan/meineDienste.test.ts`; Kern und Anschluss wie TF-VERF-09; von Hand bleibt, dass ChurchTools den Eintrag so zeigt und die eigenen Dienste stimmen
- **Historie:** Dienstplaner E7-2c (04.11.2026), Entwurf `e7-2-abwesenheiten.html`

</details>

### TF-VERF-11 · „Wann kann ich?“ – Ja, Vielleicht, Nein

**Das brauchst du:** Den Dienstplaner in der **Test-Instanz**, ein Konto ohne Admin-Recht, das Mitglied einer
ChurchTools-Gruppe ist, die an einem Dienst hängt (also in einer Dienstgruppe), und für diese Dienstgruppe den Speicher
„Antworten …" mit Rechten (sehen, anlegen, ändern, löschen). Dazu ein zweites Konto ohne diesen Speicher – und eine Person
mit dem Recht, Kategorien anzulegen (Admin) für den Einrichten-Weg. Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Jeder Termin hat drei Knöpfe **Ja · Vielleicht · Nein**; der gewählte ist gefärbt (Ja grün,
Vielleicht gelb, Nein rot) und fett. Eine Wahl ist nur **vorgemerkt** (blauer Ring), bis unten **Speichern** gedrückt ist –
dann steht „Nein" als Abwesenheit mit der Terminzeit in ChurchTools, Ja/Vielleicht im Speicher der Dienstgruppe. Am Handy
stehen die drei Knöpfe als eigene Zeile unter dem Termin, gleich breit.

1. Reiter **Wann kann ich?** öffnen. Beim ersten Termin **Ja**, beim zweiten **Vielleicht**, beim dritten **Nein** wählen →
   unten steht **„3 Änderungen vorgemerkt"**. **Verwerfen** → alles zurück. Nochmal wählen, **Speichern** →
   „3 Änderungen gespeichert". Neu laden (F5): die Wahl steht noch genauso da.
2. In ChurchTools nachsehen: bei „Nein" eine Abwesenheit mit der Zeit des Termins (Ende eine Minute früher); Ja und
   Vielleicht dort **nicht** als Abwesenheit.
3. **Nein → Ja** beim dritten Termin → die Abwesenheit verschwindet nach „Speichern" aus ChurchTools, Ja steht da.
   **Ja → Nein** → Abwesenheit entsteht, die Ja-Antwort ist weg (auch nach dem Neuladen nicht wieder da).
4. Nochmal auf den gewählten Knopf tippen → keine Antwort (bei Nein: Abwesenheit weg nach „Speichern").
5. In ChurchTools zu einem Termin mit gespeichertem Ja eine Abwesenheit von Hand eintragen → die Seite zeigt **Nein**.
6. **Zeitraum:** Bei einem Termin in einem mehrtägigen Urlaub **Ja** wählen → Rückfrage „Teil eines Zeitraums"; „Zeitraum
   löschen" merkt das Löschen **und** das Ja vor; Schließen der Rückfrage merkt nichts vor.
7. Zweites Konto (ohne Speicher): **Ja** und **Vielleicht** sind grau, oben steht „Ja/Vielleicht ist für deine
   Dienstgruppen noch nicht eingerichtet – Nein geht schon." **Nein** geht. Beim Admin steht daneben **Einrichten**: ein Tipp
   legt den Speicher an, danach sind Ja/Vielleicht frei.
8. Teilfehler (nur mit Test-Aufbau: Recht für eine von zwei Dienstgruppen entziehen): „Speichern" meldet, dass die
   Abwesenheiten gespeichert sind und für welche Dienstgruppe Ja/Vielleicht nicht – die Antwort bleibt vorgemerkt, ein
   zweites „Speichern" trägt die Abwesenheit nicht doppelt ein.
9. Aufräumen: Abwesenheiten und Antworten wieder entfernen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `dienstplaner/src/Abwesenheiten.tsx`, `dienstplaner/src/ladeVerfuegbarkeit.ts`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `ui/abwesenheiten/Abwesenheiten.module.scss`, `shared/dienstplan/verfuegbarkeit.ts`, `dienstplaner/src/start.ts`
- **Automatisiert:** weitgehend – `dienstplaner/src/Abwesenheiten.zusagen.test.tsx` (vormerken, Leiste, Verwerfen, Reihenfolge Abwesenheiten → Speicher, Nein ↔ Ja, Abwesenheit schlägt alte Antwort, Rückfrage bei Zeiträumen, gesperrt, Einrichten, Teilfehler), `dienstplaner/src/ladeVerfuegbarkeit.test.ts` (eigene Dienstgruppen, bereit/gesperrt/einrichtbar, Meldung je Dienstgruppe), Kern `shared/dienstplan/verfuegbarkeit.test.ts`; von Hand bleibt, dass ChurchTools die Abwesenheit mit der Terminzeit zeigt, die Rechte am Speicher stimmen und die Knöpfe am Handy gut zu treffen sind
- **Historie:** Dienstplaner E5c-1c (18.11.2026), Entwurf `e5c-wann-kann-ich.html` Variante 1A

</details>

### TF-VERF-12 · Notiz und „nur bestimmte Dienste“ zu einer Antwort

**Das brauchst du:** Wie TF-VERF-11 – Dienstplaner in der **Test-Instanz**, Konto in einer Dienstgruppe mit bereitem Speicher
„Antworten …“, das an mehreren Diensten (z. B. Gesang, Gitarre, Ton) teilnehmen kann. Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Unter jedem Termin mit einer Antwort steht ein kleiner Link **Notiz** (mit Text: „Notiz: …“). Er öffnet
ein Fenster **Notiz** mit dem Termin darüber. Eine Notiz ist – wie jede Wahl – nur **vorgemerkt** (blauer Ring am Knopf, die
Leiste zählt mit), bis unten **Speichern** gedrückt ist. Termine ohne Antwort haben keinen Link.

1. Bei einem Termin **Ja** wählen, **Notiz** öffnen: Feld **Kommentar** (Platzhalter „z. B. nur bis 12 Uhr“, höchstens 140
   Zeichen), darunter „Kann deine Dienstgruppe sehen.“ und **Nur bestimmte Dienste** mit einem Schalter je eigenem Dienst, alle an.
2. „nur bis 12 Uhr“ eintragen, **Ton** ausschalten, **Übernehmen** → Link heißt „Notiz: nur bis 12 Uhr“, die Leiste zählt 1.
   **Verwerfen** → Notiz weg. Nochmal, dann **Speichern**; neu laden (F5): Notiz und die Dienste stehen noch da.
3. Alle Dienste ausschalten → „Mindestens ein Dienst muss an bleiben.“, **Übernehmen** ist gesperrt. **Esc** oder **Abbrechen**
   schließt das Fenster, ohne etwas zu übernehmen.
4. Bei einem **gespeicherten** Ja nur die Notiz ändern, **Übernehmen** → eine Änderung vorgemerkt, nach „Speichern“ steht der
   neue Text da (auch ohne dass Antwort oder Dienste sich ändern).
5. Bei einem Termin **Nein** wählen, **Notiz**: nur das Feld Kommentar (kein „Nur bestimmte Dienste“), darunter „Steht als
   Kommentar der Abwesenheit in ChurchTools.“ Text eintragen, **Übernehmen**, **Speichern** → in ChurchTools hat die Abwesenheit
   diesen Kommentar. Den Kommentar bei einer gespeicherten Abwesenheit ändern → nach „Speichern“ ist er dort geändert
   (die Abwesenheit bleibt dieselbe).
6. **Ja mit Notiz → Nein:** Der Kommentar steht im Notiz-Fenster von „Nein“, nach „Speichern“ als Kommentar der Abwesenheit; die
   Dienste und die Ja-Antwort sind weg. **Nein → Ja** (vor dem Speichern): Notiz und Dienste wie vorher.
7. Bei einem Termin in einem **mehrtägigen** Urlaub (Nein): kein Link **Notiz** – der Kommentar gehört dem Zeitraum (unter
   „Einträge“ zu ändern).
8. Aufräumen: Notizen, Abwesenheiten und Antworten wieder entfernen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/abwesenheiten/NotizFenster.tsx`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `shared/dienstplan/verfuegbarkeit.ts`, `dienstplaner/src/Abwesenheiten.tsx`, `dienstplaner/src/start.ts`
- **Automatisiert:** weitgehend – `dienstplaner/src/Abwesenheiten.notiz.test.tsx` (Link, Fenster, vormerken, nur Notiz/Dienste geändert, mindestens ein Dienst, Esc/Abbrechen, Nein-Kommentar an die Abwesenheit, Wechsel Ja ↔ Nein), Kern `shared/dienstplan/verfuegbarkeit.test.ts` (Notiz/Dienste schreiben, nachlesen, alte und kaputte Werte, Vergleich), `dienstplaner/src/ladeVerfuegbarkeit.test.ts` (`eigeneDienste`); von Hand bleibt, dass ChurchTools den Kommentar an der Abwesenheit zeigt und das Fenster am Handy gut zu bedienen ist
- **Historie:** Dienstplaner E5c-2 (18.11.2026), Entwurf `e5c-wann-kann-ich.html` (Notiz-Fenster)

</details>

### TF-VERF-13 · Antworten aus „Wann kann ich?“ in der Planer-Ansicht „Personen“

**Das brauchst du:** Dienstplaner in der **Test-Instanz**, ein Konto, das den Dienst **planen** darf (Gruppe Musik), und der
Speicher „Antworten Musik“ mit dem Recht „sehen“ darauf. Mehrere Personen, die vorher in „Wann kann ich?“ geantwortet haben
(Ja, Vielleicht, eine mit Notiz, eine mit „nur Gesang“, eine mit Ja an einem Tag, an dem sie auch abwesend ist), sowie ein
Termin, den niemand beantwortet hat.

**Das muss passieren:** Unter **Planen → Personen** steht über dem Raster die Legende „Antwort der Person: Ja · Vielleicht ·
keine Antwort · Nein oder abwesend · Entwurf“. Jede Zelle ist grün (Ja), gelblich (Vielleicht), rot schraffiert (Nein oder
abwesend) oder weiß (keine Antwort); die Tags „zugesagt“, „angefragt“ und „Entwurf“ stehen unverändert davor.

1. **Planen → Personen** öffnen: Legende und Farben sind da; unter jedem Termin im Spaltenkopf steht fett „n ja · m vielleicht“.
2. Die Zahlen nachzählen: Eine Person, die in zwei Dienst-Blöcken steht (z. B. Gitarre und Gesang), zählt **einmal**.
3. Mit der Maus über eine grüne oder gelbe Zelle: der Tooltip nennt die Antwort, bei einer Notiz mit Text („Ja – nur bis 12 Uhr“).
4. Eine Person, die **„nur für Ton“** geantwortet hat, steht im Block Gesang **weiß**; der Tooltip sagt „Ja – nur für Ton“. Im
   Spaltenkopf ist sie trotzdem mitgezählt.
5. Eine Person mit **Ja und Abwesenheit** am selben Termin: die Zelle ist **rot schraffiert** (Abwesenheit schlägt die Antwort),
   die Person ist im Kopf nicht mitgezählt. Ist sie dort auch eingeteilt, sieht man weiter den roten Rahmen.
6. Einen **Dienst-Block, dessen Antworten man nicht sehen darf** (kein Recht auf „Antworten …“ der Gruppe oder noch nicht
   eingerichtet): Im Block steht „Antworten nicht sichtbar“, die Zellen sind **nicht** weiß eingefärbt-als-„keine Antwort“.
7. Netz kurz trennen und die Seite neu laden: über dem Raster steht „Die Antworten aus „Wann kann ich?“ konnten nicht geladen
   werden …“ mit **Erneut versuchen**; es gibt keine Legende und keine Zahlen im Kopf. Netz wieder an, Knopf → Farben da.
8. Am Handy: die Legende bricht um (kein Querscrollen der Seite), die Farben sind gut zu unterscheiden; Dunkelmodus: dieselben
   Farben, nur abgedunkelt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/personenAntworten.ts`, `shared/dienstplan/personenRaster.ts`, `shared/dienstplan/verfuegbarkeit.ts`, `dienstplaner/src/ladeAntworten.ts`, `dienstplaner/src/usePersonenAntworten.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PersonenRaster.module.scss`, `ui/design/_farben.scss`, `ui/design/_variables.scss`
- **Automatisiert:** weitgehend – `shared/dienstplan/personenRaster.antworten.test.ts` (Farbe, Vorrang Abwesenheit, „nur bestimmte Dienste“, Notiz, Kopfzählung), `dienstplaner/src/ladeAntworten.test.ts` (Zweige: kein Recht/fehlt, vorübergehend, 401, mehrere Kategorien), `dienstplaner/src/usePersonenAntworten.test.tsx` (bisherige Antworten bleiben), `dienstplaner/src/Planen.personen.antworten.test.tsx` (Zelle, Kopf, Legende, Hinweis, Fehlerkasten), Kern `shared/dienstplan/verfuegbarkeit.test.ts` (eine Regel „neuester Stand“ für eigene und alle); von Hand bleibt, dass Farben und Schraffur gut zu unterscheiden sind (hell/dunkel, Handy) und ChurchTools die Rechte am Speicher so vergibt
- **Historie:** Dienstplaner E5c-3 (19.11.2026), Entwurf `e5c-wann-kann-ich.html` Bereich 2, Variante D

</details>

### TF-VERF-14 · „Wer kann?“ und Zauberstab mit den Antworten aus „Wann kann ich?“

**Das brauchst du:** Wie TF-VERF-13 – Dienstplaner in der **Test-Instanz**, ein Konto, das die Dienstgruppe (Musik) **planen** darf, der
Speicher „Antworten Musik“ mit dem Recht „sehen“, und für einen Termin mit **freiem Platz** mindestens: eine Person mit Ja, eine mit
Vielleicht und Notiz, eine ohne Antwort, eine in ChurchTools **abwesende** und eine mit „nur für Ton“ (der Platz ist Gesang).

**Das muss passieren:** „Wer kann?“ zeigt die Abschnitte „Hat Ja gesagt“, „Vielleicht“, „Keine Antwort“ mit Zahlen und darunter
eingeklappt „Kann nicht / abwesend“. Der Zauberstab schlägt für diesen Platz die Person mit Ja vor, auch wenn eine andere mehr
ChurchTools-Punkte hat.

1. Freien Platz im Gesang antippen: Die Abschnitte stehen in der Reihenfolge Ja, Vielleicht, Keine Antwort; „Kann nicht / abwesend“ ist zu
   und zeigt die Zahl.
2. Die Person mit Notiz: Unter dem Namen steht kursiv „Vielleicht: „…““.
3. „Kann nicht / abwesend“ aufklappen: Die abwesende Person (Grund steht rot) und die „nur für Ton“-Person („Ja – nur für Ton“) stehen darin,
   sind aber antippbar – ein Tipp legt einen Entwurf an (Warnung wie bisher).
4. Mehr als 6 Kandidaten: Das Suchfeld filtert über alle Abschnitte, Abschnitte ohne Treffer verschwinden.
5. Zauberstab (Gruppe oder „Personen“, Dienst Gesang): Der Vorschlag für den Platz ist die Person mit Ja; im Auswahlfeld steht hinter dem
   Namen „– Ja“, „– Vielleicht …“; die „nur für Ton“-Person steht unter „Passt eher nicht“ mit „Antwort gilt nicht für diesen Dienst“.
6. Dienstgruppe, deren Antworten man **nicht sehen** darf (oder Termin-Admin ohne Planrecht): „Wer kann?“ ist **eine** Liste wie früher,
   der Zauberstab rechnet wie früher – kein Hinweis, keine Abschnitte.
7. Netz kurz trennen (oder die Kategorie sperren) und „Wer kann?“ öffnen: eine Liste wie früher plus der Hinweis „Antworten aus „Wann kann
   ich?“ gerade nicht geladen“ mit **Nochmal versuchen**; im Zauberstab steht der Hinweis über den Vorschlägen. Niemand steht dann unter
   „Keine Antwort“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/personenAntworten.ts`, `shared/dienstplan/werKann.ts`, `shared/dienstplan/zauberstab.ts`, `shared/dienstplan/personenRaster.ts`, `dienstplaner/src/WerKann.tsx`, `dienstplaner/src/WerKann.module.scss`, `dienstplaner/src/ZauberstabFach.tsx`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/TerminAnsicht.tsx`
- **Automatisiert:** weitgehend – `shared/dienstplan/personenAntworten.einordnung.test.ts` (Einordnung Ja/Vielleicht/keine/kann nicht, Sichtbarkeit, Abschnitte), `shared/dienstplan/zauberstab.antworten.test.ts` (Stufen vor Punkten, Grenze −100, „nur andere Dienste“, ohne Antworten wie bisher), `dienstplaner/src/WerKann.antworten.test.tsx` (Abschnitte, Zahlen, eingeklappt, Notiz, Suche, nicht sichtbar, Fehlerhinweis), `dienstplaner/src/ZauberstabFach.antworten.test.tsx`, `dienstplaner/src/Planen.test.tsx` (Lader aus Planen bis ins Fenster); von Hand bleibt der Eindruck am Handy und mit echten ChurchTools-Rechten
- **Historie:** Dienstplaner E5c-4 (19.11.2026), Entwurf `e5c-wann-kann-ich.html` Bereich 3, Variante A

</details>

### TF-VERF-15 · „Erinnern“: Mail an alle, die noch nicht geantwortet haben

**⚠️ Das verschickt echte Mails.** Nur auf der **Test-Instanz** und nur an **dich selbst** (oder ein eigenes Test-Konto) ausprobieren – die
anderen Personen vor dem Senden **abwählen**.

**Das brauchst du:** Dienstplaner in der **Test-Instanz**, ein Konto, das die Dienstgruppe (Musik) **planen** darf, der Speicher „Antworten
Musik“ mit dem Recht „sehen“, mehrere kommende Termine mit Musik-Diensten und ein Mitglied der Gruppe (du oder ein Test-Konto mit Mail-Adresse), das
für mindestens einen Termin **weder Ja/Vielleicht noch Nein** (Abwesenheit) eingetragen hat und dort nicht eingeteilt ist.

**Das muss passieren:** In Planen liegt „Erinnern“ im **⋯**-Menü (mit „Teilen“; seit B3, vorher ein Knopf in der Zeile). Das Fenster nennt die Fehlenden mit ihren offenen Terminen, zeigt vorher
die Mail und verschickt je Person eine eigene.

1. In Planen **⋯ → Erinnern** tippen: Die Unterzeile nennt den gezeigten Zeitraum, die Dienstgruppen stehen als Knöpfe mit der Zahl der Fehlenden da;
   die erste Gruppe mit Fehlenden ist gewählt. Eine Gruppe, deren Antworten du nicht sehen darfst, ist gesperrt – mit Grund darunter.
2. Alle Personen außer dir abwählen („An 1 Person senden“). Bei dir „Vorschau“ antippen: Betreff, „Hallo <Vorname>,“, deine offenen Termine und der Knopf
   „Im Dienstplaner eintragen“.
3. „Text anpassen“: Betreff und Text ändern (auch ein `<` und `&` eintippen) – die Vorschau zeigt es, in der Mail steht der Text unverändert als Text.
4. „Eine Kopie an mich“ anhaken und senden: „1 Mail verschickt.“ Im Postfach kommt **eine** Mail an (plus genau **eine** Kopie, nicht mehrere); der Knopf
   „Im Dienstplaner eintragen“ öffnet „Wann kann ich?“ der Erweiterung; darunter hängen die Termin-Knöpfe von ChurchTools.
5. Mit Ja/Nein beantworten und das Fenster neu öffnen: Du stehst nicht mehr in der Liste. An einem Termin, an dem du eingeteilt bist, auch nicht.
6. Konto ohne das Recht, Mails zu Terminen zu schicken (falls vorhanden): „ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.“, nichts verschickt.
7. Netz trennen und senden (mit zwei Test-Konten): angehalten, „X von Y verschickt“; die Person, bei der es hakte, steht als „unklar, ob die Mail rausging“ und
   ist **nicht vorgewählt**. „An die übrigen senden“ schickt niemandem etwas doppelt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/erinnern.ts`, `dienstplaner/src/erinnernSenden.ts`, `dienstplaner/src/ErinnernFenster.tsx`, `dienstplaner/src/ErinnernErgebnis.tsx`, `dienstplaner/src/ladeErinnern.ts`, `dienstplaner/src/Planen.tsx`, `ui/erweiterung/kuerzel.ts`
- **Automatisiert:** weitgehend – `shared/dienstplan/erinnern.test.ts` (Regel „wer fehlt“, gesperrte Lage, Empfänger über Gruppen, Mail-Text mit Maskierung), `dienstplaner/src/erinnernSenden.test.ts` (alle Zweige: Erfolg, abgelehnt, 422, 401, 403, 429/5xx/Netz = unklar, Kopie nur einmal, nur die übrigen), `dienstplaner/src/Planen.erinnern.test.tsx` (Menüeintrag, Fenster, Vorschau = Versand, Ergebnis, Esc), `dienstplaner/src/ladeErinnern.test.ts`; von Hand bleibt, dass die Mail wirklich ankommt (Absender, Knopf, Termin-Knöpfe, Kopie) und ob Planer ohne Admin-Recht `POST /events/send` dürfen
- **Historie:** Dienstplaner E5c-5 (19.11.2026), Entwurf `e5c-5-erinnern.html`, Variante B

</details>
