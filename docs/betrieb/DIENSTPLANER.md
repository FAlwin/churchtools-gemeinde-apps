# Dienstplaner – ChurchTools-Erweiterung

> **Stand: v0.10.0 (19.11.2026: „Wann kann ich?“ – Mitarbeitende sagen je Termin Ja, Vielleicht oder Nein; Planer sehen die Antworten in „Personen“, in „Wer kann?“ und beim Zauberstab. v0.9.0: „Alle verwerfen“, Fenster schließen mit Escape).** Was die Reiter können:
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
>   Freien Platz antippen → „Wer kann?“ (Abschnitte nach den Antworten: Ja, Vielleicht, keine Antwort, kann nicht) → **Entwurf**;
>   Zauberstab (erst Ja, dann Vielleicht, dann ohne Antwort – je Stufe nach der ChurchTools-Rangfolge),
>   Vorlieben je Person (Stift), Platzzahl (Regler: auch Dienste ein- und ausschalten, Terminvorlage übernehmen), „Infos & Dateien“ je Termin, **„Personen“** (Raster: Zeile je Person und Dienst; Klick in eine leere Zelle = Entwurf als Anfrage, nochmal = direkt, nochmal = weg; Klick auf eine bestehende Einteilung = dasselbe Fenster wie in der Matrix, zurückgezogene stehen rot durchgestrichen; Zauberstab je Dienst im Block-Kopf; Antworten als Fläche: Ja grün, Vielleicht gelb, Nein/abwesend rot schraffiert), Vorgabe **„Anfrage oder direkt“** je Dienst (Symbol am Dienstnamen, je Gerät), „Wer wie oft?“, Filter nach Kalender,
>   Veranstaltung, Gruppe **und einzelnem Dienst** (unter der Gruppe; gilt für Matrix und „Personen“, in „Personen“ klappt ein
>   Antippen des Dienstes seinen Block zu), **Fokus** (eine Person im ganzen Plan gelb umranden), **Ansehen und senden** bzw. **Alle verwerfen**, **Erinnern** (Mail an alle, die noch nicht geantwortet haben), **Teilen** = Plan,
>   eine Gruppe oder „Wir suchen noch …“ als PDF. Am Handy ein Termin auf einmal.
> - **Wann kann ich?:** je Termin **Ja**, **Vielleicht** oder **Nein** (Nein = Abwesenheit in ChurchTools, nur für die Terminzeit),
>   dazu eine Notiz und „nur bestimmte Dienste“; Urlaub als Zeitraum (ganze Tage). Ja/Vielleicht liegen im Speicher „Antworten
>   <Dienstgruppe>“ (einmal „Einrichten“, Rechte setzt die Verwaltung). Die Adresse bleibt `#/abwesenheiten`.
> - **Hilfe „?“** (Planen, Dienste, Termin-Ansicht für Planer): Statt langer Erklär-Absätze unter der Seite öffnet der Knopf
>   „?“ ein Fenster mit kurzen Abschnitten (Texte in `dienstplaner/src/hilfeTexte.ts`, Baustein `ui/bedienung/HilfeKnopf.tsx`).
>   Kurze Hinweise in Fenstern, Status-, Fehler- und Leer-Texte und Warnungen bleiben dort, wo sie stehen.
>
> Hell oder dunkel wie in ChurchTools gewählt. Diese Anleitung wächst mit.

Der Dienstplaner plant die Dienste **aller** Dienstgruppen (Musik, Technik, Predigt, Moderation …) nach
dem Vorbild von Planning Center Services. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server.
Benachrichtigungen (Anfragen, Absagen) verschickt ChurchTools selbst; zusagen und absagen geht in der
ChurchTools-App und zusätzlich im Dienstplaner.

## Installieren

> **Vorher einmalig:** Erweiterungen muss der ChurchTools-Support für eure Instanz freischalten. Fehlt unter
> _Administration_ der Punkt „Erweiterungen“, beim Support melden – siehe
> [Erweiterungen freischalten](ERWEITERUNG.md#erweiterungen-freischalten).

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

| Wer                               | Darf im Dienstplaner             | Woher (ChurchTools)                                                                      |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| alle mit Zugang zur Erweiterung   | eigene Dienste und Gruppen sehen | Erweiterung „Dienstplaner“ sehen                                                         |
| Planer einer Dienstgruppe         | diese Dienstgruppe planen        | Recht „Dienste einer Dienstgruppe bearbeiten“ für diese Dienstgruppe                     |
| Leitung der Gruppe eines Dienstes | diesen Dienst planen             | Rolle mit Leitung in der ChurchTools-Gruppe des Dienstes                                 |
| Admin eines Termins               | an diesem Termin planen          | als Admin am Termin eingetragen                                                          |
| Ablauf-Pflege                     | Abläufe bearbeiten (ab E6)       | Recht „Ablauf bearbeiten“ für den Kalender oder Admin des Termins                        |
| Vorlagen-Pflege                   | Ablaufvorlagen bearbeiten (E10)  | Recht „Ablaufvorlagen bearbeiten“ (`edit agenda templates`) für den Kalender der Vorlage |
| Planer mit Entwürfen              | Entwürfe einer Gruppe eintragen  | Rechte auf die Kategorie „Entwürfe <Gruppe>“ (s. u.)                                     |

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
**Alle verwerfen** (18.11.2026) daneben in der Leiste löscht nach einer Rückfrage genau diese Entwürfe – auch die anderer
Planer –, ohne etwas zu senden; in ChurchTools ändert sich nichts. Was ein anderer inzwischen geändert hat, bleibt liegen
(Versions-Schutz wie bei „Entfernen“), der Hinweis danach nennt die Zahl.

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
  „verwerfen“. In ChurchTools ändert sich dabei nichts. **Ändert man die Platzzahl im Dienstplaner (19.11.2026), gehen die
  Entwürfe dieses Dienstes an diesem Termin mit:** Nach der geglückten Änderung trägt der Dienstplaner sie selbst auf ihre neuen
  Nummern um (`anzahlMitEntwuerfen` in `ladeEntwuerfe.ts`; Rechnung `umzuegeRechnen`, Ablauf `entwuerfeMitnehmen` in
  `shared/dienstplan/umnummerieren.ts`, ein Entwurf zieht über `entwurfUmziehen` um – frisch lesen, Version vergleichen,
  schreiben, nachlesen, nie wiederholt). Gemessen (Test-Instanz, 19.11.2026): Vergrößern hängt hinten an, bestehende Plätze
  behalten ID und Nummer (nur 1 → 2 macht aus „ohne Nummer“ die 1); Verkleinern nimmt freie Plätze von hinten weg und rückt die
  übrigen lückenlos auf, die ID bleibt – über sie findet jeder Entwurf seinen neuen Platz (die ID ist zwischen dem Lesen
  vorher und nachher stabil, nur unser `PUT` liegt dazwischen). Fällt der Platz mit dem Entwurf weg, geht er auf einen freien
  Platz ohne Entwurf; findet sich keiner, bleibt er liegen und das Schild „ohne Platz“ zeigt ihn. Gelingt ein Umzug nicht,
  steht die Platzzahl trotzdem (nichts wird zurückgedreht), eine Meldung sagt „N Entwürfe konnten nicht mitgehen – bitte neu
  laden“; danach lädt „Planen“ Plan und Entwürfe neu. **Gesperrt** (− und +, „Hier liegt ein Entwurf – erst senden oder
  entfernen“) ist ein Dienst mit Entwürfen nur noch, wo man die Entwürfe der Gruppe nicht ändern darf (Schublade nicht „bereit“).
- **Plätze-Regler in der Gruppenzeile** (Plätze-Fach, jede Änderung gilt sofort, ChurchTools verschickt dabei nichts):
  Das Fach zeigt **jeden Dienst der Dienstgruppe**, den man an diesem Termin planen darf – auch Dienste, die im
  gezeigten Zeitraum noch nirgends einen Platz haben (dann „nicht vorgesehen“, 0): „+“ schaltet den Dienst für diesen
  Termin ein, „−“ bis 0 wieder aus. **„+“ geht immer** – auch mit Entwürfen (sie gehen mit); **„−“ stoppt bei den Plätzen mit Inhalt:**
  Untergrenze = belegte Plätze + Entwürfe auf **freien** Plätzen (ein Entwurf auf einem belegten Platz – Ersetzen, Zurückziehen –
  zählt nicht extra), dazu der Hinweis „Auf den freien Plätzen liegen Entwürfe – zum Verkleinern erst einen entfernen.“ (eine
  Rechnung: `plaetzeGrenze` in `plaetzeGrenze.ts`, für Regler, Hinweise und Fenster). Die Matrix zeigt einen
  neu eingeschalteten Dienst nach dem Schließen des Fachs (sie lädt dann neu). Oben steht, wenn es für den Kalender des
  Termins ChurchTools-Terminvorlagen gibt, **„Vorlage übernehmen“**: Vorlage wählen → Vorschau (im Fach Moderation & Predigt etwa
  „Abendmahl: 0 → 1“, dazu was übersprungen wird) → „Übernehmen“. Die Vorlage **nimmt nur dazu**: Ein Dienst wird auf die
  Zahl der Vorlage erhöht, nie verringert oder entfernt; sie ändert **nur die Dienste der Gruppe, deren Fach offen ist**
  (Dienste anderer Gruppen in der Vorlage übergeht sie still), lässt nur Dienste aus, die gesperrt sind (Entwürfe, die man nicht umtragen darf), und der Terminname bleibt. Jeder Dienst wird einzeln gespeichert – scheitert einer,
  laufen die anderen weiter, am Ende steht, was geklappt hat und was nicht. Sind die Vorlagen von ChurchTools nicht
  erreichbar, sagt das Fach es ruhig; die Plätze lassen sich trotzdem ändern.

**Ansicht „Personen“** (Wunsch 5, P1 – ansehen, P2a – eintragen per Klick; dritter Knopf in Planen neben „Matrix“ und „Wer wie oft?“, ab
16.11.2026): Dieselben Termine wie die Matrix (gleicher Zeitraum, gleiche Filter, auch der Besuch von der Startseite) als
Raster – Spalten = Termine, Zeilen = Personen, **ein Block je Dienst** in der Reihenfolge der Matrix. Eine Person steht in
**jedem** ihrer Dienste (Zeile je Person **und** Dienst), daneben „auch Gesang“ (andere gezeigte Dienste, in denen sie
Mitglied ist). In der Zelle steht der Dienst als Tag in der Farbe des Dienstes, das Symbol sagt den Zustand: Haken =
zugesagt, Kreis mit ? = angefragt; ein **Entwurf** ist blau – **gestrichelt** mit „?“ = Anfrage, **durchgezogen** mit
Haken = direkt (beide Symbole im gefüllten Kreis, Alwin 17.11.2026). Am selben Tag in einem **zweiten Dienst** eingeteilt:
grauer Text „+ Gesang“; gehört der andere Dienst zu einer **ausgeblendeten** Gruppe, steht er blass und schräg mit der
Gruppe („+ Ton (Technik)“). **Abwesend** = grauer Tag mit dem Grund; ist die Person dort zugleich eingeteilt, bleiben
beide da (roter Rand am grauen Tag – ein Warnfall). „Einsätze“ zählt zugesagte und angefragte Einteilungen dieser Person
in diesem Dienst in den gezeigten Terminen – **und gültige Entwürfe** (s. „Entwürfe zählen mit“). „Gäste“ sind Plätze mit Namen ohne Person. Die Fußzeile **„Noch offen“** zeigt
je Termin die freien Plätze der gezeigten Dienste („Gesang ×2“) – gezählt wie in der Matrix, also ebenfalls mit gültigen Entwürfen. „Namen verbergen“ zeigt auch
hier nie einen Namen. Maus über dem Namen hebt alle Zeilen der Person schwach blau hervor; Antippen des Namens nimmt die Person in den **Fokus** (s. u.). Am Handy ist es
dieselbe Tabelle, waagerecht scrollbar, die Namensspalte bleibt stehen. Kürzel und Farben einstellen kommt mit P3.

**Eintragen per Klick (P2a, 16.11.2026):** Ein Klick in eine **leere Zelle** (Person × Termin im Block eines Dienstes) legt sofort
einen **Entwurf** an – derselbe Weg wie die Wahl in „Wer kann?“ (gleiche Funktion, gleicher Hinweis „… eingetragen – noch nicht
gesendet“, gleicher Schutz gegen gleichzeitige Änderungen), auf den **ersten freien Platz** dieses Dienstes an diesem Termin
(ein Platz mit Entwurf ist nicht zu haben, wie beim Zauberstab: `freiOhneEntwurf`). Danach steht in der Zelle der Entwurf (blau, gestrichelt, „?“ = Anfrage)
und unten die Leiste „Ansehen und senden“. Gesendet wird nichts, bevor man dort sendet. Ein Klick auf den **eigenen Entwurf**
schaltet ihn weiter (**Klick-Zyklus**, P2m, s. u.: Anfrage → direkt → weg; „weg“ ist „Entfernen“ im Entwurfs-Fach); der Entwurf eines
**anderen Planers** ist kein Knopf – den öffnet man in der Matrix.

- **Warnfenster** (nur dann, mit „Abbrechen“ und „Trotzdem eintragen“): die Person ist am selben Tag **schon in einem anderen
  Dienst** eingeteilt („Daniel F. ist am Fr, 20.11. schon bei Gesang eingeteilt. Trotzdem für Ton eintragen?“) oder an dem Tag
  **abwesend** (Grund und Zeitraum der Abwesenheit); treffen beide zu, steht beides in einem Fenster. Die Sätze rechnet
  `shared/dienstplan/personenEintragen.ts` aus dem, was die Zelle ohnehin zeigt („+ Gesang“, Abwesend-Tag).
- **Klick-Zyklus Anfrage → direkt → weg (P2m, 17.11.2026):** Der **erste** Klick legt den Entwurf an – als **Anfrage** (gestrichelter
  Rahmen, „?“ im gefüllten Kreis) oder, wenn der Dienst auf „direkt“ gestellt ist (Vorgabe, s. u.), gleich als **direkt**
  (durchgezogener Rahmen, Haken im gefüllten Kreis, kräftiger). Dieselbe Regel gilt in der Matrix (direkt und Gast
  durchgezogen); Darüberfahren dunkelt dort nur die Fläche ab. Der **zweite** Klick auf den eigenen Entwurf stellt eine Anfrage auf **direkt** um (ohne
  Rückfrage zugesagt), der **dritte** nimmt ihn weg; ist er schon direkt, nimmt schon der zweite weg. Das **Warnfenster** (anderer
  Dienst am Tag, abwesend) kommt nur beim ersten Klick. Umgestellt wird mit **derselben Funktion** wie „Beim Senden: Anfrage |
  direkt“ im Entwurfs-Fach (`modusAendern` in `useEinteilen.tsx`, mit der Version des Entwurfs als Versions-Schutz). Die Zelle
  sagt es auch dem Vorleser („Ton, Entwurf, Anfrage“ / „… direkt“), der Zellen-Knopf nennt den nächsten Schritt („auf direkt
  umstellen“ / „Entwurf wegnehmen“). In einem **abgesagten** Termin nimmt schon der erste Klick auf den eigenen Entwurf ihn weg.
  Die Entscheidung „was tut der Klick“ steht in `zellenAktion` (`personenEintragen.ts`: `eintragen`, `direkt`, `wegnehmen`).
  „Platz übernehmen“ behält den Modus des ersetzten Entwurfs wie bisher.
- **Abwesenheit als Schraffur (P2m, Variante D):** Eine Zelle, in der die Person abwesend ist, ist **diagonal schraffiert** (leicht
  getönt, seit E5c-3 **rot** statt grau); der Grund steht nur als Text mit dem Abwesend-Symbol, **kein Kasten** mehr. Im Dunkelmodus dieselbe Schraffur in der
  helleren Farbe, der Text hell. **Warnfall** (abwesend UND eingeteilt/Entwurf): kräftigere rote Schraffur und ein 2 px roter Rahmen um die ganze
  Zelle. Im Warnfall steht **kein Grund als Text**, nur das durchgestrichene Abwesend-Symbol **vor** dem Entwurf- bzw. Einteilungs-Tag; der Grund steht im Tooltip und Namen der Zelle („Krank – trotzdem eingeteilt“) und im Warnfenster. Die Farben sind Tokens in `ui/design` (`--abw-text`, `--antwort-nein-schraffur`,
  `--antwort-nein-toenung`, `--abw-warn-schraffur`, `--abw-warn-toenung`, hell in `_farben.scss`, dunkel in `_variables.scss`); Klick und Hover
  der Zelle bleiben wie in P2a.
- **Platz übernehmen (P2a-2):** Gibt es keinen freien Platz ohne Entwurf, nimmt der Klick einen Platz mit **gültigem
  „Zurückziehen“-Entwurf** (belegt mit X): aus „X zurückziehen“ wird **„X durch Y ersetzen“** – derselbe Weg wie „Andere Person
  wählen“ in der Matrix (`trageEin`/`onWahl`, mit der Version des Entwurfs als Versions-Schutz, Hinweis „Y statt X eingetragen –
  noch nicht gesendet“). Ein freier Platz ohne Entwurf hat immer Vorrang. Die Warnungen (anderer Dienst, abwesend) gelten wie
  beim normalen Eintragen. Nimmt man Y wieder weg, ist der Platz wieder X wie in ChurchTools (ein Platz = ein Entwurf; das
  „Zurückziehen“ ist mit dem Ersetzen aufgegangen und kommt nicht zurück – in der Matrix ist es bei „Andere Person wählen“ und
  „Entfernen“ genauso). Die Regel „welcher Platz ist zu haben“ ist `platzFuerEintrag` (`personenEintragen.ts`). Der **Zauberstab**
  füllt solche Plätze bewusst nicht (er speichert ohne Versions-Schutz, und das „Zurückziehen“ hat der Planer absichtlich gesetzt).
- **Dienst voll** (kein Platz mehr zu haben: weder frei ohne Entwurf noch mit „Zurückziehen“-Entwurf): Fenster „Ton ist voll“ mit
  „[Dienst] am 27.11. ist voll (2 von 2).“ und dem Knopf **„Platz dazunehmen (3)“** (P2c): `usePlatzDazu` erhöht erst die Platzzahl in
  ChurchTools um 1 (sofort, derselbe Weg wie der Regler: `entwuerfe.anzahl` → `anzahlAendern`), lädt den Termin neu und legt –
  **erst, wenn der neue Platz im neuen Plan wirklich da ist** – den Entwurf an (derselbe Weg wie der normale Klick, Modus aus der
  Vorgabe; Warnungen „anderer Dienst“/„abwesend“ stehen vorher im selben Fenster). Scheitert das Erhöhen: Meldung des Reglers, kein
  Entwurf. Scheitert erst der Entwurf: der Platz bleibt, es erscheint die Meldung des Entwurfs. Kommt der neue Platz – oder ein
  mit umgezogener Entwurf (bei 1 → 2) – binnen 20 s nicht, gibt es eine Meldung und keinen Entwurf. **Liegt an diesem Dienst
  und Termin ein Entwurf, geht „Platz dazunehmen“ trotzdem** (seit 19.11.2026: die Entwürfe gehen mit, die Sperre „Erst senden
  oder Entwürfe entfernen“ ist weg; wer die Entwürfe der Gruppe nicht ändern darf, bekommt in „Personen“ ohnehin keinen
  Klick). Gingen Entwürfe nicht mit, gibt es eine Meldung, keinen neuen Entwurf, und Plan und Entwürfe laden neu.
- **Zeile „Plätze“ (P2c):** am Ende jedes geöffneten Dienst-Blocks, je Termin „belegt von Plätzen“ („2 von 3“), gezählt wie „Noch offen“
  (`plaetzeStand` → `zaehleFrei`, Entwürfe zählen mit): freie Plätze rot, voll neutral, ohne Plätze „aus“. Ein Klick darauf – und auf
  einen roten Tag in „Noch offen“ – öffnet ein Fenster mit − / + für **diesen** Dienst an diesem Termin (`PlatzFenster`, Regler und
  Logik wie das Plätze-Fach der Matrix: `PlatzRegler`, `useAnzahlSetzen`). Sofort gespeichert, − nicht unter die Belegten und die Entwürfe auf freien Plätzen, + ohne
  Obergrenze (auch mit Entwürfen – sie gehen mit); beide gesperrt nur, wo die Entwürfe nicht umgetragen werden dürfen. Rechte wie der Regler (`darfPlanen`, Anschluss zum Ändern der
  Plätze); an abgesagten Terminen kein Regler.
- **Wo es ein Knopf ist:** nur, wo man in der Matrix auch einen freien Platz antippen kann – den Dienst planen dürfen (`darfPlanen`),
  Entwürfe der Dienstgruppe geladen und änderbar (`darfAendern`: Schublade bereit). Sonst bleibt die Zelle wie bisher. Eine
  **bestehende Einteilung** (zugesagt, angefragt, Gast) anklicken öffnet das Fenster der Matrix (P2b, s. u.); „Noch offen“
  bleibt unverändert. **Abgesagte Termine** nehmen keine Einträge an (P2a-2, s. u.).
- **Aussehen:** mit echter Maus (`hover: hover`) bekommt eine leere, eintragbare Zelle beim Darüberfahren einen blauen Rahmen,
  eine blasse blaue Fläche und ein „+“ rechts; am Handy/Touch zeigt sie ein blasses „+“. Jede dieser Zellen ist ein Knopf
  (Tastatur, Vorleser: „Daniel F. für Ton am Fr, 20.11. eintragen“). Der Klick auf den **Namen** setzt weiter den Fokus.
- **Entwürfe zählen mit (P2a-2, 16.11.2026):** In **Matrix und „Personen“ gleich** zählt ein **gültiger** (nicht veralteter)
  Entwurf schon wie das, was er bewirken wird. Das betrifft „N frei“ im Termin-Kopf, den Füllbalken, die Datumsleiste und die
  Karte am Handy, die Gruppenzeile (Matrix) sowie „Einsätze“ und „Noch offen“ in „Personen“. Person oder Gast auf einem freien
  Platz → der Platz gilt als besetzt (frei −1; bei einer Person „Einsätze“ +1); „Zurückziehen“ auf einem belegten Platz → frei
  (frei +1; „Einsätze“ der bisherigen Person −1); eine Person durch eine andere ersetzen → frei bleibt gleich, die „Einsätze“
  wandern. **Veraltete Entwürfe zählen nicht** (dort gilt ChurchTools). Einen Extra-Hinweis gibt es nicht – die Entwürfe stehen
  ja blau gestrichelt da. Die Regel steht in `shared/dienstplan/platzNachEntwurf.ts` (`platzGiltFrei`, `zaehleFrei`; daraus
  `terminStand` und `gruppenFrei` in `plan.ts`); „wer steht am Platz“ beantwortet weiter `platzPerson` (`fokus.ts`), mit
  derselben Gültigkeit. **Bewusst ohne Entwürfe** bleiben **Teilen/PDF** („Wir suchen noch …“, Plan als PDF, Termin-Blatt) und
  alles, was an ChurchTools geht: dort zählt nur ChurchTools, ein Entwurf ist noch nicht verbindlich (`PlanGruppe.frei` ist
  der ChurchTools-Stand). Ebenso unverändert: die Termin-Liste und die Startseite („Plätze frei“), „Wer wie oft?“ und die Zeile
  „+ Gesang“ in „Personen“.
- **Bestehende Einteilung anklicken (P2b, 17.11.2026):** In „Personen“ öffnet ein Klick auf eine **zugesagte oder angefragte**
  Einteilung (auch auf einen **Gast** in der Zeile „Gäste“) **dasselbe Fenster wie das Antippen eines belegten Platzes in der
  Matrix** (`BelegtFach`: „Zurückziehen“, „Andere Person wählen“) – über `sicht.onBelegt` in `useEinteilen`, keine zweite
  Logik. Wird eine Einteilung von einem **gültigen Entwurf weggenommen** (Zurückziehen **oder** Ersetzen durch jemand
  anderen), steht die Zelle wie in der Matrix **rot gestrichelt, mit „−“ und durchgestrichenem Namen**
  (`RasterZelle.zustand: 'zurueck'`; Farben, Fläche und Durchstreichen als eine Regel in `dienstplaner/src/_zurueck.scss`, die
  Matrix nutzt sie ebenfalls); ihr Klick öffnet das **Entwurfs-Fenster** (`sicht.onEntwurf`, „Entfernen“ nimmt das
  Zurückziehen zurück). „Andere Person wählen“ führt zu „Wer kann?“ für diesen Platz; das Ergebnis ist ein Ersetzen-Entwurf: die
  neue Person steht als Entwurf in ihrer Zeile, die bisherige durchgestrichen. **Rechte wie in der Matrix** (`personenErlaubt`
  in `useEinteilen`): das Fenster am belegten Platz verlangt nur `darfPlanen` (auch in abgesagten Terminen; ohne Schublade
  nennt es nur Name und Stand), das Entwurfs-Fenster zusätzlich `darfAendern`. Ein belegter Platz mit **veraltetem** Entwurf ist wie
  in der Matrix kein Knopf (dort gilt ChurchTools). Klick auf den **Namen** setzt weiter den Fokus, der Klick auf den eigenen
  Entwurf bleibt der Zyklus aus P2m. Eine zurückgezogene Zelle ist kein Warnfall mehr (Abwesenheit).
- **Gäste von Hand eintragen (P2d, 17.11.2026):** Die Zeile „Gäste“ steht in **jedem** Dienst-Block, in dem man eintragen darf (auch
  ohne Gast; sonst nur, wo Gäste stehen). Eine **leere** Gäste-Zelle ist ein Knopf („Gast für Ton am Fr, 20.11. eintragen“) und
  öffnet das Fenster `GastFenster` („Gast eintragen – Ton · Fr, 20.11.“): Namensfeld `GastFeld` – **dieselbe Komponente, dieselbe Regel (mindestens 2 Zeichen nach dem Trimmen, `gastNameAus`) und derselbe Hinweistext (`gastName.ts`) wie „Jemand ohne ChurchTools-Konto“ in `WerKann.tsx`**; Enter sendet, Hauptknopf „Als Entwurf eintragen“. Das Anlegen läuft über `personen.eintragen` mit
  `{ art: 'gast', name }` – also `trageEin` und die Wahl in „Wer kann?“ (Gäste bekommen nie eine Anfrage, Konflikt-Schutz und
  Hinweis wie dort). Welcher Platz frei ist, entscheidet **dieselbe Funktion wie bei einer leeren Personen-Zelle**
  (`freierPlatzAktion` in `shared/dienstplan/personenEintragen.ts`; für die Gäste-Zelle als `gastNeuAktion`); die Rechte sind
  `personenErlaubt` (`darfPlanen`, Schublade/`darfAendern`, `nimmtEintraegeAn`). Hat die Zelle schon Gäste (bestehend oder
  Entwurf), bleibt das Tag ein Knopf wie in P2b, dazu ein kleines „+“ für einen weiteren Gast. **Dienst voll:** dasselbe
  Fenster mit Voll-Satz und „Platz dazunehmen (n)“ (`usePlatzDazu`, jetzt für `Besetzung` – Person **oder** Gast); auch mit
  einem Entwurf an Dienst und Termin (er geht mit). Gast-Entwürfe zählen
  über `platzGiltFrei` bei „Plätze“ und „Noch offen“ mit (nichts Neues).
- **Abgesagte Termine nehmen keine Einträge an (P2a-2):** In der Matrix ist der freie Platz in einem abgesagten Termin kein
  Knopf („Wer kann?“ öffnet nicht), in „Personen“ gibt es dort zum **Eintragen** keinen Zellen-Knopf, kein Hover und kein „+“ –
  den **eigenen Entwurf** nimmt ein Klick dort weiter weg, wie in der Matrix –, und der Zauberstab
  füllt ihn nicht (`nimmtEintraegeAn`, `plan.ts` – eine Funktion für alle drei und für den Regler „Plätze ändern“).
  **Vergangene Termine bleiben eintragbar** (Nachtragen); nur der Zauberstab lässt sie zusätzlich aus. Bestehende Einteilungen
  und Entwürfe in abgesagten Terminen bleiben sichtbar; einen belegten Platz antippen (zurückziehen/ersetzen) und einen
  vorhandenen Entwurf in der Matrix öffnen geht weiter.
- **Zauberstab je Dienst in „Personen“ (P2z):** Im Kopf jedes Dienst-Blocks steht rechts neben „N Personen“ ein Zauberstab
  („Zauberstab: Ton für alle gezeigten Termine vorschlagen“). Er öffnet **dasselbe Fenster** wie der Zauberstab der Matrix,
  nur für die freien Plätze **dieses einen Dienstes** an allen gezeigten Terminen (Titel „Automatische Planung · Ton“).
  Übernommen wird als Entwurf, wie in der Matrix. Es ist **dieselbe Funktion** (`onZauberstab(spalten, gruppe, dienstId?)` →
  `zauberZeilen`, `planEntwuerfe.ts`): ohne `dienstId` rechnet sie die ganze Gruppe (Matrix), mit `dienstId` einen Dienst
  („Personen“); die Regeln (abgesagt/vergangen ausgelassen, Plätze mit Entwurf bleiben, Zurückziehen-Plätze nicht gefüllt,
  Recht und Schublade) sind dieselben. **Kein Knopf**, wo es dort nichts zu füllen gibt – wie in der Matrix (kein freier Platz
  ohne Entwurf, nichts zu planen, Schublade nur lesbar, nur abgesagte/vergangene Termine frei). Der Block-Kopf klebt am Handy
  beim Scrollen links, der Knopf bleibt erreichbar.

**Vorgabe „Anfrage | direkt“ je Dienst (P2m, 17.11.2026, Entwurf `e9-p2-modus.html`, Variante G4):** Ob ein **neuer** Entwurf als
Anfrage oder gleich als **direkt** (ohne Rückfrage als zugesagt eingetragen, z. B. für Prediger) beginnt, legt man **je Dienst** fest.
In der **Matrix** – und gleich im **Kopf jedes Dienst-Blocks in „Personen“**, neben dem Zauberstab (dieselbe Komponente `VorgabeKnopf`, dasselbe Fenster, dieselbe Sichtbarkeitsregel) – steht am Dienstnamen nur ein **rundes Symbol** (18 px): „?“ als Umriss = Anfrage, Haken gefüllt = direkt, blau;
Tooltip und Vorleser „Neue Einteilungen für Ton: Anfrage – ändern“, die Tippfläche ist größer als das Symbol. Es erscheint nur, wo man
den Dienst planen und seine Entwürfe ändern darf, in Tabelle, Handy-Zettel und Block-Kopf. Die Termin-Ansicht liest die Vorgabe, hat aber (vorerst) kein Symbol. Ein Klick **öffnet nur ein kleines Fenster**
(„Vorgabe · Ton“: Segment „Anfrage | direkt“, Erklärsatz, „Für alle Dienste übernehmen“, Hinweis „Gilt auf diesem Gerät“) – es wird
**nie per Klick am Symbol umgeschaltet**. Die Vorgabe wird **je Gerät** gemerkt (im Browser, `direktDienste` in der gemerkten
Planen-Ansicht, `planenAnsicht.ts`; kein Eintrag = Anfrage), nicht in ChurchTools und nicht für andere Planer. Sie wirkt auf **neue**
Entwürfe aus „Wer kann?“, dem ersten Klick in „Personen“, „Hier eintragen“ (Fokus-Leiste) und dem Zauberstab (Matrix und „Personen“) –
überall über **eine** Funktion (`modusFuer` in `useEinteilen.tsx`, `modusFuerDienst` in `shared/dienstplan/modusVorgabe.ts`); auch die
Termin-Ansicht liest sie. **Bestehende Entwürfe bleiben unverändert**, ein ersetzter Entwurf behält seinen Modus. „Ansehen und senden“
nennt je Entwurf „Anfrage an …“ bzw. „Direkt zuteilen: …“ und zählt beides oben – zur Kontrolle, nur lesen. Das Wort ist überall
**„direkt“** (nicht „fest“); der Knopf „Direkt zuteilen“ im Entwurfs-Fach bleibt.

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
- **Antworten aus „Wann kann ich?“ (E5c-3, 19.11.2026, Entwurf `e5c-wann-kann-ich.html` Bereich 2, Variante D):** Die Fläche jeder
  Zelle zeigt die Antwort der Person auf diesen Termin: **Ja grün**, **Vielleicht gelblich**, **Nein/abwesend rot schraffiert**,
  **keine Antwort weiß** (Tokens `--antwort-ja`, `--antwort-vielleicht`, `--antwort-nein-schraffur`/`-toenung` in `ui/design`,
  hell und dunkel; „Wer kann?“ nutzt sie nicht – dort sind es Abschnitte, E5c-4). Die Tags (zugesagt/angefragt/Entwurf) liegen davor.
  Regeln in `shared/dienstplan/personenAntworten.ts`: **Abwesenheit schlägt die Antwort** (`flaecheAus`); bei **„nur bestimmte
  Dienste“** (`Antwort.dienste`, fehlt = alle) gilt die Antwort in einem anderen Dienst nicht – die Zelle bleibt weiß, Tooltip und
  Vorlesetext sagen es („Ja – nur für Gesang“); die **Notiz** steht dort ebenfalls („Ja – nur bis 12 Uhr“, `antwortText`). Der
  **Spaltenkopf** zeigt fett „n ja · m vielleicht“ = **verschiedene Personen** im Raster mit dieser Antwort am Termin (eine
  Person in zwei Blöcken zählt einmal; „nur für Ton“ zählt auch im Gesang-Block mit; Abwesende zählen nicht); die **Legende** steht
  über dem Raster, sobald Antworten sichtbar sind. Der Schlüssel der Antwort ist die **Termin-ID als Text** (wie in „Wann kann ich?“).
  - **Laden** (`ladeAntworten.ts`, `usePersonenAntworten.ts`): je **Dienstgruppe** der gezeigten Dienste eine Kategorie
    `dienstplaner-antworten-<Dienstgruppe>`, alle Personen einer Kategorie (`alleAntwortenLesen`), höchstens drei gleichzeitig.
    Es werden nur Dienstgruppen gelesen, die man **planen** darf (Sichtbarkeit für Mitglieder: E5c-6); nötig ist nur das Recht
    **„sehen“** auf die Kategorie, nicht „bereit“. Über mehrere Kategorien gilt je Person der **neueste `stand`** (bei Gleichstand
    die kleinere Kategorie-ID) – **dieselbe Funktion** (`neuesterStand`) wie bei den eigenen Antworten.
  - **Zweige:** Kategorie fehlt oder kein Recht (auch 403 beim Lesen) = „Antworten nicht sichtbar“ im Block, dauerhaft, keine Farbe.
    401 und jede vorübergehende Störung (Netz, 5xx, gebremst, Zeitüberschreitung) **werfen** für das Ganze: Beim ersten Laden steht
    ein Hinweis mit „Erneut versuchen“ (ohne Legende und Zahlen), beim Neuladen bleiben die bisherigen Antworten stehen und der
    Hinweis steht daneben. Ein Fehlschlag wird nie als „keine Antwort“ gezeigt.
- **Antworten in „Wer kann?“ und im Zauberstab (E5c-4, 19.11.2026, Entwurf `e5c-wann-kann-ich.html` Bereich 3, Variante A):**
  **Eine Regel für Raster, „Wer kann?“ und Zauberstab** in `shared/dienstplan/personenAntworten.ts`: `antwortFuer` (Antwort einer
  Person auf einen Termin im Blick auf einen Dienst, mit Sichtbarkeit der Dienstgruppe) und `antwortStufe` (Ja / Vielleicht / keine /
  kann nicht). **„Wer kann?“** (`werKann.ts` → `abschnitteAus`, `WerKann.tsx`) zeigt, sobald die Antworten der Dienstgruppe des Platzes
  sichtbar sind, die Abschnitte **„Hat Ja gesagt“ · „Vielleicht“ · „Keine Antwort“** und **„Kann nicht / abwesend“ (eingeklappt)**, je mit
  Zahl; innerhalb eines Abschnitts bleibt die Reihenfolge „frei und selten dran“, die Notiz steht kursiv als zweite Zeile
  (`Vielleicht: „nur bis 12 Uhr“`). In „Kann nicht“ steht, wer in ChurchTools **abwesend** ist (auch mit Ja – Abwesenheit schlägt die Antwort)
  und wer **nur für andere Dienste** geantwortet hat („Ja – nur für Gesang“); die Personen dort bleiben wählbar, Warnungen bleiben rot,
  ein Klick trägt trotzdem ein. Die Suche (ab 7 Kandidaten) filtert über alle Abschnitte. **Nicht sichtbar** (Kategorie fehlt, kein Recht,
  Dienstgruppe nicht planbar) = die eine Liste wie vor E5c-4; **vorübergehender Fehler** = dieselbe Liste plus Hinweis „Antworten aus
  „Wann kann ich?“ gerade nicht geladen“ (mit „Nochmal versuchen“) – nie alle unter „Keine Antwort“; die Kandidaten warten nicht auf
  die Antworten, nur auf deren Ergebnis (geladen oder gescheitert). Geladen wird mit **demselben Lader wie „Personen“** (`AntwortenLader`,
  in `App.tsx` durch `Planen`/`TerminAnsicht` → `useEinteilen` → `WerKann`/`ZauberstabFach`), je Fenster für die eine Dienstgruppe des Platzes.
  **Zauberstab** (`zauberstab.ts`): bei sichtbaren Antworten gehen **Stufen vor Punkten** – Ja, dann Vielleicht, dann keine Antwort; innerhalb
  einer Stufe wie bisher Punktzahl, `imLauf`, Name; die Grenze −100 bleibt; wer „nur für andere Dienste“ geantwortet hat, wird für diesen
  Dienst nicht genommen (`laufGrund: 'andere-dienste'`). Ohne sichtbare Antworten oder beim Ladefehler rechnet er wie früher (Hinweis im Fenster).
  Das Fenster zeigt die Antwort hinter dem Namen („Ben (0×) – Ja“). Dienstnamen für „nur für Gesang“ kommen aus dem Plan (nur Dienste, die
  darin stehen – wie im Raster).
- **Der gemerkte Wert `personen`** (bis 16.11.2026 der Name von „Wer wie oft?“) wird beim Lesen zu `werWieOft`; das neue
  Raster heißt intern `raster`. Wer „Wer wie oft?“ gemerkt hatte, sieht es weiter.

**Fokus-Modus** (Wunsch 11, 16.11.2026; Entwurf `e11-fokus.html`): **eine** Person „anleuchten“ – alle ihre Einsätze in
Matrix, Handy-Zettel und „Personen“ werden **gelb umrandet** (Rahmen als Outline außen, blasse deckende gelbe Fläche; was im
Platz steht – grün, ?, blau gestrichelt – bleibt sichtbar). Darüber die **Fokus-Leiste**: „Fokus: Daniel F. · 5 Einsätze in
5 Terminen · 1 angefragt · 1 Entwurf · 1 ausgeblendet“ und „Fokus aus“. Gezählt wird über die Termine des gewählten
Zeitraums (nach Kalender/Veranstaltung gefiltert, ohne **abgesagte** Termine) und über **alle** Dienste – ein per Filter
ausgeblendeter Dienst ist trotzdem ein Einsatz, die Leiste sagt „N ausgeblendet“. Ein gültiger Entwurf auf die Person zählt
und wird umrandet, ein veralteter nicht (dort gilt ChurchTools). Verglichen wird über die `personId`; Gäste und „Namen
verbergen“ sind nie fokussierbar.

- **Vier Wege hinein:** (1) **Matrix:** Fokus-Symbol am Namen eines belegten Platzes (nur mit echter Maus, beim Darüberfahren
  – ein eigener Knopf neben dem Platz, löst nie das Fenster aus), am Handy **lang drücken** (500 ms, nicht beim Wischen; das
  Antippen danach wird verschluckt), und im Fenster eines belegten Platzes oben **„Im Plan hervorheben“**. (2) **„Wer kann?“:**
  je Kandidat eine Mini-Zeile („Im Plan, ±7 Tage: Gesang Mi 17.12. · Bild So 21.12.“ – Einsätze aus den geladenen Terminen)
  und der Knopf **„im Plan zeigen“**: Fenster zu, Fokus auf die Person; die Leiste zeigt zusätzlich **„‹ Zurück zu ‚Wer kann?‘
  für Ton · So, 20.12.“** (dasselbe Fenster für denselben Platz, auch nach „Andere Person wählen“) und **„Hier eintragen“**
  (legt den Entwurf mit derselben Funktion an wie die Wahl im Fenster – `useEinteilen.trageEin` → `eintragenFuer.onWahl`;
  fehlt, wo man dort nicht eintragen darf). (3) **Suchfeld „Person hervorheben“** in der Werkzeugleiste (am Handy hinter einem
  Such-Symbol): Treffer am Anfang des Namens oder eines Wortes, Vorschläge mit Kreis, Name und Diensten – aus den im
  geladenen Plan Eingeteilten. (4) In **„Personen“** das Antippen des Namens (zweites Antippen: „Fokus aus“).
- **Dauer:** bleibt beim Wechsel Matrix ↔ Personen ↔ Wer wie oft? und beim Blättern; endet mit „Fokus aus“ oder beim
  Verlassen von Planen; wird **nicht** gemerkt. Eine andere Wahl löst die Person ab (immer nur eine).
- **Technik:** Zustand nur in `Planen.tsx` (`fokusPerson`), die Ansichten lesen ihn über `Sicht.fokusId`/`onFokus`. Die eine
  Regel „wer steht an diesem Platz“ ist `shared/dienstplan/fokus.ts` (`platzPerson`) – Umrandung, Zählen, Suchvorschläge und
  Mini-Zeile rechnen alle daraus. Farben: `--fokus`, `--fokus-grund`, `--fokus-text` in `ui/design/_farben.scss` (Dunkel:
  nur die Schrift in `_variables.scss`).

**Erinnern** (E5c-5, 19.11.2026; Entwurf `e5c-5-erinnern.html`, Variante B „Alles in einem“): In **Planen** steht neben „Teilen“ der
Knopf **„Erinnern“** (Umschlag; nur für Planer mit mindestens einer planbaren Dienstgruppe im gezeigten Plan, am Handy nur das
Symbol). Er schickt **eine Mail an jede Person, der noch eine Antwort aus „Wann kann ich?“ fehlt** – Absender ist der Planer
(ChurchTools verschickt, `POST /events/send`). **Es wird wirklich verschickt** – auf der Test-Instanz nur an eigene Konten ausprobieren.

- **Das Fenster:** oben die **Dienstgruppen** als Knöpfe mit der Zahl der Fehlenden („Musik · 3“; vorgewählt ist die erste Gruppe mit
  Fehlenden), darunter die **Empfänger** – je Person einmal („N offen: So, 06.12. · Mi, 09.12.“, mit Haken zum Abwählen und
  **Vorschau**, die genau die Mail zeigt, die verschickt wird). Gehört eine Person zu zwei gewählten Gruppen, steht sie einmal da
  (mit beiden Gruppen und allen offenen Terminen). **„Text anpassen“** (einklappbar): Betreff und Text nach „Hallo <Vorname>,“; darunter
  folgen automatisch ihre offenen Termine und der Knopf **„Im Dienstplaner eintragen“** (führt auf „Wann kann ich?“ der Erweiterung,
  volle Adresse mit Instanz und Kürzel). ChurchTools hängt je Termin zusätzlich einen eigenen Knopf zum Termin an (nicht abschaltbar).
  **„Eine Kopie an mich“**: genau eine Kopie, nicht je Person.
- **Wer „fehlt“** (Regel in `shared/dienstplan/erinnern.ts`, gerechnet aus denselben Daten wie die Ansicht „Personen“): Mitglied
  der Dienstgruppe, das für **mindestens einen** Termin weder Ja/Vielleicht noch Nein hat. Termine: die gezeigten (wie bei „Teilen“),
  **heute oder später**, nicht abgesagt, und nur solche, an denen die Dienstgruppe einen Dienst hat. **Beantwortet** zählt: Ja,
  Vielleicht (auch „nur bestimmte Dienste“, selbst wenn es den eigenen Dienst nicht nennt) und Nein = Abwesenheit in ChurchTools
  (dieselbe Regel `decktTermin` wie überall). Wer an dem Termin **in dieser Gruppe schon eingeteilt** ist (zugesagt oder angefragt),
  fehlt dort nicht.
- **Gesperrte Gruppe:** Ist die Lage unsicher – Antworten oder Abwesenheiten nicht sichtbar, Mitglieder verborgen, Laden
  gescheitert –, ist die Gruppe **gesperrt**, mit kurzem Grund („Antworten nicht sichtbar“); nie wird so getan, als fehlten alle.
  Vorübergehende Gründe bieten „Erneut versuchen“.
- **Versand** (`dienstplaner/src/erinnernSenden.ts`): je Person **ein** Aufruf, nacheinander; Erfolg erst, wenn ChurchTools die Person in
  `sentRecipientIds` nennt. In `rejectedRecipientIds` oder bei 422 (keine Mail-Adresse): **nicht erinnert**, es geht weiter. Bei einem
  **vorübergehenden Fehler** (Netz, Zeitüberschreitung, Bremse, 5xx) **hält es an**: Die Mail könnte trotzdem rausgegangen sein, darum
  wird nichts wiederholt, und die Person steht als „unklar, ob die Mail rausging“. Abgemeldet (401) und fehlendes Recht (403) halten
  ebenfalls an. Das Ergebnis nennt, wer verschickt ist, wer nicht erinnert ist (keine Mail-Adresse) und wer noch offen ist;
  **„An die übrigen senden“** schickt nur Personen ohne Ergebnis – wer unklar ist, ist **nicht vorgewählt** (man kann ihn bewusst
  anhaken). Während es läuft, schließt Esc das Fenster nicht.
- **Offen/ungemessen:** Dürfen Planer ohne Admin-Recht `POST /events/send` aufrufen? (Gemessen nur mit einem Konto mit allen
  Rechten.) Fehlt das Recht, steht „ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.“

**Ablaufvorlagen ansehen und bearbeiten** (E10-V3a, 17.11.2026; Entwurf `e10-vorlagen.html`): In **Planen** steht in der
Werkzeugleiste links neben „Ablauf bearbeiten“ der Knopf **„Vorlagen“** – kein eigener Reiter, „Planen“ bleibt markiert,
**„‹ Planen“** führt zurück. Die Seite hat die Adresse `#/vorlagen`, eine geöffnete Vorlage `#/vorlage/<ID>` (Zurück im Browser
und Neuladen gehen).

- **Liste:** Die Vorlagen von ChurchTools nach **Kalender** gruppiert; je Zeile Name und „N Punkte · N vor Beginn · geändert
  TT.MM.“. Wo man in dem Kalender **keine** Vorlagen bearbeiten darf, steht am Band **„nur ansehen“** (Schloss). **„Neue Vorlage“**
  erscheint nur, wenn man in mindestens einem Kalender darf.
- **Neue Vorlage:** Name (höchstens 100 Zeichen) und Kalender – angeboten werden nur Kalender mit dem Recht. Danach geht die leere
  Vorlage gleich im Bearbeiten-Modus auf. Vorbelegt ist der Kalender, in dem es schon die meisten Vorlagen gibt.
- **Vorlage öffnen:** derselbe Ablauf-Baustein wie am Termin, aber **ohne Uhrzeiten, Personen, Live, Musik-App und Auge**
  („An diesem Termin weglassen“ gibt es ohne Termin nicht). **Infos je Dienstgruppe** gibt es wie am Termin (Feld im Fenster,
  Knopf „Spalten“ mit eigener, gemerkter Wahl für die Vorlagen-Seite) – an Text- und Lied-Punkten; an Überschriften nicht
  (ChurchTools nähme sie mit Erfolg an und speicherte nichts). Dienste stehen als Platzhalter „[Moderation]“ da, nicht als offener Dienst
  mit „?“. „vor Beginn“ gibt es auch in Vorlagen. **Bearbeiten** nur mit dem Recht; dann stehen rechts in der Hinweiszeile
  **„Umbenennen …“** und **„Löschen …“** (rot).
- **Löschen** fragt nach und lässt sich **nicht rückgängig machen** (ChurchTools hat dafür keinen Papierkorb); Abläufe, die schon aus
  der Vorlage entstanden sind, bleiben. Gesperrte Vorlagen (in ChurchTools gesperrt, per Schnittstelle nicht zu entsperren)
  melden das und lassen sich nur dort ändern.
- **Als Vorlage …** (E10-V5, 17.11.2026): Im **Bearbeiten-Modus eines Termin-Ablaufs** steht rechts in der Hinweiszeile **„Als
  Vorlage …“** – **links neben „Neu aufsetzen …“**, nur in der Termin-Ansicht (nicht in der Matrix) und nur mit dem Recht
  „Ablaufvorlagen bearbeiten“ **für den Kalender des Termins**. Ein Fenster, zwei Wege: **Als neue Vorlage** (Name, vorbelegt mit dem
  Termin-Titel; Kalender, vorbelegt mit dem des Termins; nur Kalender mit Recht) oder **Vorhandene Vorlage ersetzen** (nur
  Vorlagen, die man bearbeiten darf, die des Termin-Kalenders zuerst; roter Hinweis mit den Zahlen, roter Knopf „Ersetzen“; Name und
  Kalender der Vorlage bleiben). Übernommen werden alle Einträge mit Dauer, Notiz, Infos je Dienstgruppe, Liedern und Platzhaltern wie
  „[Moderation]“ – **keine Namen von Personen**; nur an diesem Termin ausgeblendete Einträge (Auge) kommen mit. Hat inzwischen jemand
  die Vorlage geändert, kommt „… woanders geändert …“ statt eines Überschreibens. Fehler (kein Recht, gesperrt, nicht vollständig
  geschrieben) stehen im Fenster. Technik: `ui/ablauf/AlsVorlageFenster.tsx`, `useAlsVorlage.tsx`, Kern `ablaufAlsVorlage` /
  `vorlageErsetzen` in `shared/ct/ablaufVorlagen.ts`, Zugriff `browserAlsVorlageZugriff` (`ui/ablauf/browserAblaufZugriff.ts`).
- **Technik:** Die Bausteine liegen in `ui/ablauf/` (`VorlagenBereich`, `VorlagenListe`, `VorlageAnsicht`, `VorlagenFenster`,
  der Vorlagen-Modus `vorlage` in `useAblaufBearbeiten`/`PunktFenster`/`AblaufListe`) und kennen weder ChurchTools noch den Weg
  dorthin – das gibt die App über den `VorlagenZugriff` herein (Dienstplaner: `dienstplaner/src/vorlagenZugriff.ts` über den Kern
  `shared/ct/ablaufVorlagen.ts` und `schreibKern.ts`; seit V3b liegt der Browser-Zugriff in `ui/ablauf/browserAblaufZugriff.ts`, den
  sich Dienstplaner und Musik-App-Erweiterung teilen; die Musik-App zeigt dieselbe Seite unter **Mehr → Abläufe → Ablaufvorlagen**,
  im Server-Betrieb über `/api/ablauf-vorlagen/…`). Die Liste rechnet
  `shared/ct/ablaufVorlagenListe.ts` aus `GET /agendatemplates` und `GET /calendars`.

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
  eigene Vorschläge zählen mit den Abzügen von ChurchTools mit (Messprotokoll E5-0); seit E5c-4 gehen bei sichtbaren Antworten Stufen (Ja, Vielleicht, keine) vor Punkten; geladen in
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
