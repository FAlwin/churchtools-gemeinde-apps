# Dienstplaner – ChurchTools-Erweiterung

> **Stand: v0.4.0 (16.11.2026: Ansicht „Personen“ in Planen; Plätze-Regler schaltet Dienste ein und aus und übernimmt Terminvorlagen).** Was die Reiter können:
>
> - **Start:** „Als Nächstes“ (dein nächster Dienst mit Team, Liedern, Musik-App), offene Anfragen zum Beantworten,
>   deine nächsten Dienste, Abwesenheiten; für Planer die freien Plätze der nächsten 6 Wochen – eine Gruppe antippen
>   öffnet Planen mit nur dieser Gruppe und diesen 6 Wochen (nur für diesen Besuch). Datum oder Titel eines Termins
>   führen direkt in die Termin-Ansicht.
> - **Dienste:** Liste nach Monaten, „Meine | Alle“, Filter nach Kalender und Veranstaltung. Offene Anfragen zusagen oder absagen,
>   eigene Dienste **tauschen**; unter „Meine“ **Teilen** = alle kommenden eigenen Dienste als PDF.
> - **Termin-Ansicht** (Zeile antippen): Ablauf wie in der ChurchTools-App, mit Recht **bearbeiten** (Stift, Ziehen,
>   „An diesem Termin weglassen“, „Ablauf anlegen“ / „Neu aufsetzen …“), die Dienste des Termins, **Infos & Dateien**
>   (i, Büroklammer), **Live** (Folgen bzw. Steuern wie die Live-Agenda von ChurchTools), **Teilen** = Termin-Blatt
>   als PDF, Sprung in die Musik-App. **Lieder** im Punkt-Fenster wie in der Musik-App: anderes Lied wählen (Suche,
>   Häufigkeit, Zuletzt), „Verknüpfung aufheben“, „Neues Lied“ samt SongSelect und Notenblatt-Editor – mit dem Recht,
>   Lieder zu sehen (anlegen: Lieder bearbeiten, SongSelect: CCLI-Recht); ohne bleibt die Lied-Ansicht. Wer einen Dienst
>   planen darf, **teilt hier ein** wie in „Planen“ (freier Platz → „Wer kann?“, Entwurf, Zauberstab je Gruppe) und
>   sendet mit **Ansehen und senden** nur die Entwürfe dieses Termins.
> - **Planen** (nur Planer): Termine als Spalten, Dienstgruppen und Dienste als Zeilen, der Ablauf als Gruppe oben.
>   Freien Platz antippen → „Wer kann?“ → **Entwurf**; Zauberstab (Vorschläge nach der ChurchTools-Rangfolge),
>   Vorlieben je Person (Stift), Platzzahl (Regler: auch Dienste ein- und ausschalten, Terminvorlage übernehmen), „Infos & Dateien“ je Termin, **„Personen“** (Raster: Zeile je Person und Dienst, nur ansehen), „Wer wie oft?“, Filter nach Kalender,
>   Veranstaltung, Gruppe **und einzelnem Dienst** (unter der Gruppe; gilt für Matrix und „Personen“, in „Personen“ klappt ein
>   Antippen des Dienstes seinen Block zu), **Ansehen und senden**, **Teilen** = Plan,
>   eine Gruppe oder „Wir suchen noch …“ als PDF. Am Handy ein Termin auf einmal.
> - **Abwesenheiten:** eigene eintragen, ändern, löschen – direkt in ChurchTools.
>
> Hell oder dunkel wie in ChurchTools gewählt. Diese Anleitung wächst mit.

Der Dienstplaner plant die Dienste **aller** Dienstgruppen (Musik, Technik, Predigt, Moderation …) nach
dem Vorbild von Planning Center Services. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server.
Benachrichtigungen (Anfragen, Absagen) verschickt ChurchTools selbst; zusagen und absagen geht in der
ChurchTools-App und zusätzlich im Dienstplaner.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`dienstplaner-v….zip`** herunterladen (nicht entpacken). Die Dienstplaner-Releases heißen
   „Dienstplaner v…" – nicht verwechseln mit den Releases der Musik App oder der Anmeldungen.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Dienstplaner" – so heißt der Menüpunkt.
   - **Kürzel:** genau **`dienstplaner`**. Die Erweiterung ist für diese Adresse gebaut
     (`/ccm/dienstplaner/`); mit einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit
deren Sitzung. **Ein eigenes Rechte-System gibt es nicht.**

| Wer                               | Darf im Dienstplaner             | Woher (ChurchTools)                                                  |
| --------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| alle mit Zugang zur Erweiterung   | eigene Dienste und Gruppen sehen | Erweiterung „Dienstplaner“ sehen                                     |
| Planer einer Dienstgruppe         | diese Dienstgruppe planen        | Recht „Dienste einer Dienstgruppe bearbeiten“ für diese Dienstgruppe |
| Leitung der Gruppe eines Dienstes | diesen Dienst planen             | Rolle mit Leitung in der ChurchTools-Gruppe des Dienstes             |
| Admin eines Termins               | an diesem Termin planen          | als Admin am Termin eingetragen                                      |
| Ablauf-Pflege                     | Abläufe bearbeiten (ab E6)       | Recht „Ablauf bearbeiten“ für den Kalender oder Admin des Termins    |
| Planer mit Entwürfen              | Entwürfe einer Gruppe eintragen  | Rechte auf die Kategorie „Entwürfe <Gruppe>“ (s. u.)                 |

Gemessen an der Test-Instanz (08. und 13.10.2026). Alle drei Wege gelten seit E3-4 (eine Regel:
`darfDienstPlanen`). Der Reiter „Planen“ erscheint für globale Planer und Gruppenleitungen; wer nur Admin
einzelner Termine ist, sieht das an diesen Terminen. Seit E4-4 wird im Dienstplaner auch eingeteilt – mit genau
diesen Rechten; ChurchTools prüft sie beim Schreiben selbst noch einmal.

**Entwürfe – eine Kategorie je Dienstgruppe** (E4-3, Alwin 14.10.2026): Noch nicht gesendete Einteilungen liegen
in ChurchTools im Speicher des Dienstplaners, je Dienstgruppe in einer eigenen Kategorie „Entwürfe <Gruppe>“
(Kürzel `dienstplaner-entwuerfe-<ID>`). So schützt ChurchTools die Gruppen voneinander.

- **Einrichten:** Fehlt einer Gruppe die Kategorie, zeigt „Wer kann?“ den Knopf **„Einrichten“** – nur wer in
  ChurchTools Kategorien anlegen darf. Wer sie anlegt, bekommt sofort alle Rechte darauf (gemessen).
- **Freischalten:** Danach in ChurchTools für die anderen Planer dieser Gruppe die Rechte auf diese Kategorie
  setzen: **Daten sehen** (Entwürfe ansehen) und **Daten anlegen, ändern, löschen** (eintragen). Ohne die drei
  zum Ändern steht „ansehen, aber nicht ändern“ da.
- **Vorsicht:** ChurchTools nimmt dasselbe Kürzel zweimal an (gemessen). Sieht jemand die Kategorie nur nicht,
  weil ihm das Sehrecht fehlt, legt „Einrichten“ eine zweite an. Deshalb zuerst das Recht geben, nicht einrichten.
  Gibt es doch zwei, nehmen alle Geräte die mit der kleinsten Nummer.

**Senden** (E4-4, 15.10.2026): „Ansehen und senden“ zeigt alle gültigen Entwürfe im geladenen Zeitraum, wo man
planen und die Entwürfe der Gruppe ändern darf – auch die anderer Planer. Je Zeile ein Häkchen; Abgewähltes bleibt
Entwurf. Hinweise (abwesend, am Tag schon eingeteilt) stehen vorher da, senden geht trotzdem.

- **Mitteilungen schickt ChurchTools**, nicht der Dienstplaner. Gemessen (14./15.10.2026): Eine **Anfrage** und
  **„Direkt zuteilen“** lösen die Push-Mitteilung der ChurchTools-App aus, aber keine Mail je Einteilung. Ein **Gast**
  bekommt nichts. **Austragen** (zurückziehen) durch einen Planer benachrichtigt die Person **nicht**; wird sie
  dagegen durch eine andere Person **ersetzt**, bekommt sie „Dienstaustragung – Du wurdest aus dem Dienst …
  ausgetragen“ (gemessen 15.10.2026, angefragt wie zugesagt). Eine Platzzahl zu ändern verschickt nichts.
- **Sicher:** Je Platz frisch lesen → schreiben → nachlesen. Steht inzwischen jemand anderes da, wird nichts
  überschrieben („Konflikt“, der Entwurf ist dann veraltet). Das gilt auch, wenn eine angefragte Person
  inzwischen zugesagt hat – wer gerade zugesagt hat, wird nicht still ausgetragen oder ersetzt (Alwin, 15.10.2026). Erst wenn die Person nachgelesen am Platz steht, wird
  der Entwurf entfernt. Antwortet ChurchTools nicht oder ist man abgemeldet, hält das Senden an; der Rest bleibt
  Entwurf. Nichts wird von selbst wiederholt – „Erneut senden“ ist ein bewusster zweiter Klick.
- **Entwürfe ohne Platz, alte Entwürfe:** Ändert jemand direkt in ChurchTools die Platzzahl (die Plätze werden dabei
  neu nummeriert) oder nimmt den Dienst heraus, oder ist der Termin vorbei bzw. gelöscht, passt ein Entwurf nirgends
  mehr. Dann steht beim Dienst ein Schild „Entwurf ohne Platz“ bzw. über der Matrix „N alte Entwürfe“ – beides mit
  „verwerfen“. In ChurchTools ändert sich dabei nichts. Im Dienstplaner selbst ist die Platzzahl gesperrt, solange
  dort Entwürfe liegen.
- **Plätze-Regler in der Gruppenzeile** (Plätze-Fach, jede Änderung gilt sofort, ChurchTools verschickt dabei nichts):
  Das Fach zeigt **jeden Dienst der Dienstgruppe**, den man an diesem Termin planen darf – auch Dienste, die im
  gezeigten Zeitraum noch nirgends einen Platz haben (dann „nicht vorgesehen“, 0): „+“ schaltet den Dienst für diesen
  Termin ein, „−“ bis 0 wieder aus. Belegte Plätze und Dienste mit Entwürfen bleiben unverändert. Die Matrix zeigt einen
  neu eingeschalteten Dienst nach dem Schließen des Fachs (sie lädt dann neu). Oben steht, wenn es für den Kalender des
  Termins ChurchTools-Terminvorlagen gibt, **„Vorlage übernehmen“**: Vorlage wählen → Vorschau („Abendmahl: 0 → 1 ·
  Musik: 3 → 5“, dazu was übersprungen wird) → „Übernehmen“. Die Vorlage **nimmt nur dazu**: Ein Dienst wird auf die
  Zahl der Vorlage erhöht, nie verringert oder entfernt; sie wirkt über alle Dienstgruppen, wo man planen darf, lässt
  Dienste mit Entwürfen aus, und der Terminname bleibt. Jeder Dienst wird einzeln gespeichert – scheitert einer,
  laufen die anderen weiter, am Ende steht, was geklappt hat und was nicht. Sind die Vorlagen von ChurchTools nicht
  erreichbar, sagt das Fach es ruhig; die Plätze lassen sich trotzdem ändern.

**Ansicht „Personen“** (Wunsch 5, P1 – nur ansehen; dritter Knopf in Planen neben „Matrix“ und „Wer wie oft?“, ab
16.11.2026): Dieselben Termine wie die Matrix (gleicher Zeitraum, gleiche Filter, auch der Besuch von der Startseite) als
Raster – Spalten = Termine, Zeilen = Personen, **ein Block je Dienst** in der Reihenfolge der Matrix. Eine Person steht in
**jedem** ihrer Dienste (Zeile je Person **und** Dienst), daneben „auch Gesang“ (andere gezeigte Dienste, in denen sie
Mitglied ist). In der Zelle steht der Dienst als Tag in der Farbe des Dienstes, das Symbol sagt den Zustand: Haken =
zugesagt, Kreis mit ? = angefragt, Stift gestrichelt = Entwurf. Am selben Tag in einem **zweiten Dienst** eingeteilt:
grauer Text „+ Gesang“; gehört der andere Dienst zu einer **ausgeblendeten** Gruppe, steht er blass und schräg mit der
Gruppe („+ Ton (Technik)“). **Abwesend** = grauer Tag mit dem Grund; ist die Person dort zugleich eingeteilt, bleiben
beide da (roter Rand am grauen Tag – ein Warnfall). „Einsätze“ zählt zugesagte und angefragte Einteilungen dieser Person
in diesem Dienst in den gezeigten Terminen. „Gäste“ sind Plätze mit Namen ohne Person. Die Fußzeile **„Noch offen“** zeigt
je Termin die freien Plätze der gezeigten Dienste („Gesang ×2“) – gezählt wie in der Matrix. „Namen verbergen“ zeigt auch
hier nie einen Namen. Maus über dem Namen (am Handy Antippen) hebt alle Zeilen der Person hervor. Am Handy ist es
dieselbe Tabelle, waagerecht scrollbar, die Namensspalte bleibt stehen. Ein Klick in eine Zelle tut noch nichts
(Eintragen kommt mit P2, Kürzel und Farben einstellen mit P3).

- **Wer eine Zeile bekommt:** die Mitglieder der ChurchTools-Gruppen des Dienstes (`/services` → `groupIds`, mehrere Gruppen
  werden zusammengeführt – Café hängt an fünf) **plus** wer im Zeitraum dort eingeteilt ist, aber nicht Mitglied ist
  („nicht in der Gruppe“), **plus** Personen mit einem gültigen Entwurf. Darin alphabetisch.
- **Was geladen wird:** je ChurchTools-Gruppe der gezeigten Dienste (jede einmal, höchstens vier gleichzeitig)
  `GET /groups/{id}/members` und `GET /groups/{id}/absences?from&to` – über den ganzen geladenen Zeitraum der Matrix, damit
  Blättern im Fenster nichts neu lädt. Gemessen 13.11.2026 (nur lesen): 32 Abfragen parallel 342 ms.
- **Abwesenheiten sieht nur, wer das Recht hat:** global „Abwesenheiten verwalten“ (`manage absent`) **oder** in der
  Gruppe „Abwesenheiten sehen“ (`+view absence`, `/permissions/internal/groups`). Ohne Recht liefert ChurchTools still
  eine **leere** Liste – deshalb wird dann gar nicht gefragt, und der Block sagt ruhig „Abwesenheiten nicht sichtbar“
  (bei nur einem Teil der Gruppen: „nur teilweise sichtbar“). Ein 403 auf die Mitglieder heißt „Mitglieder einer Gruppe nicht
  sichtbar – es stehen nur die Eingeteilten da“.
- **Aussetzer zerstören nichts:** Scheitert eine Gruppe vorübergehend (Netz, Zeitüberschreitung, 5xx, gebremst), steht im
  Block dieses Dienstes der Hinweis mit **„Nochmal versuchen“** – es wird nur diese Gruppe neu geholt, der Rest bleibt.
  Abgemeldet (401) zeigt den Hinweis zum Neuladen der Seite. Bei einem späteren Neuladen bleibt der bisherige Stand stehen.
- **Der gemerkte Wert `personen`** (bis 16.11.2026 der Name von „Wer wie oft?“) wird beim Lesen zu `werWieOft`; das neue
  Raster heißt intern `raster`. Wer „Wer wie oft?“ gemerkt hatte, sieht es weiter.

**Den Menüpunkt sehen:** Erweiterung **„Dienstplaner“ sehen** – für alle, die Dienste haben. Ohne dieses
Recht zeigt ChurchTools selbst „Keine ausreichende Berechtigung“.

**Was in der Matrix steht** (Prüfung mit drei Rollen, 13.10.2026, #525): ChurchTools liefert die Plätze
einer Dienstgruppe nur dann **vollständig**, wenn die Dienstgruppe „für alle sichtbar“ ist, man sie sehen
oder bearbeiten darf oder eine Gruppe des Dienstes leitet. Sonst kommen nur die **eigenen** Einträge. Die
Matrix und „Wer wie oft?“ zeigen deshalb nur vollständig gelieferte Dienste (`siehtDienstGanz`), denn eine
halbe Zeile sähe aus wie „nicht vorgesehen“. Die eigenen Dienste stehen immer unter Start und Dienste.

**Selbst prüfen:** In der Test-Instanz als Admin eine Person öffnen → Symbol „Benutzer simulieren“ (der
Browser-Bereich der App unterdrückt die Rückfrage; dann `?q=simulate&id=<Person>&location=churchdb`
aufrufen). Testnutzer Spike (19) hat nur „Dienstplaner sehen“.

## Für Entwickler

- Code: `dienstplaner/` (Erweiterung), Regeln in `shared/ct/` (`dienstRechte.ts`, `dienstgruppen.ts`),
  ChurchTools-Verbindung, Anmeldung und Seitenrahmen in `ui/` (`ui/ct/`, `ui/erweiterung/`) – dieselben
  wie bei den Anmeldungen.
- Vorlieben (Stift, E5-3): nur über die alte Schnittstelle, an einer Stelle `shared/dienstplan/vorlieben.ts` (Erfolg erst nach dem Nachlesen – ohne Recht meldet ChurchTools `success` und schreibt nichts).
- Zauberstab (E5): Regeln in `shared/dienstplan/zauberstab.ts`, Fenster `dienstplaner/src/ZauberstabFach.tsx`, Symbol aus der ChurchTools-Schrift über `CtSymbol.tsx` – wie der ChurchTools-Zauberstab (über −100),
  eigene Vorschläge zählen mit den Abzügen von ChurchTools mit (Messprotokoll E5-0); geladen in
  `dienstplaner/src/ladeZauberstab.ts`.
- Termin-Ansicht (E6-1b): `dienstplaner/src/TerminAnsicht.tsx`, Adresse `#/termin/<id>` (`reiter.ts`); der Ablauf ist
  derselbe Baustein wie in der Musik-App (`ui/ablauf/AblaufListe`, Regeln einer Zeile in `shared/ct/ablaufZeile.ts`).
  Geladen wird frisch: `ladeTermin` (dieselbe Regel wie Liste und Matrix) und `ladeAblauf` (404 = kein Ablauf).
  Bearbeiten (E6-3a): Recht `ablaufBearbeitbar` (`start.ts`, Regel `shared/ct/ablaufRecht.ts`), Liste
  `ui/ablauf/useAblaufBearbeiten`, Aktionen `dienstplaner/src/ablaufAktionen.ts` → Schreibkern
  `shared/ct/schreibKern.ts` über `ui/ct/schreiber.ts` (derselbe Schreiber wie die Musik-App); nach jedem Schreiben
  wird nur der Ablauf neu gelesen.
- Ansehen ohne ChurchTools: `npm run dev -w dienstplaner`, dann
  `http://localhost:5178/ccm/dienstplaner/?demo` (`?demo=mitglied`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `dienstplan-vX.Y.Z` → `dienstplaner-release.yml` → gemeinsame Vorlage
  `erweiterung-release.yml` (**nie „latest"** – sonst sähen die Musik-Apps keinen Update-Hinweis mehr).
- Bauplan und Entwurf: `~/ecg-donrath/gemeinde-apps/dienstplaner-planung/docs/bauplan.md` (außerhalb des Repos).
