# Dienstplaner – ChurchTools-Erweiterung

> **Stand: E6-1b (17.10.2026)** – E3 mit drei Rollen geprüft (Test-Instanz) und lesend an der Live-Instanz; seit
> E4-4 **teilt der Dienstplaner auch ein** (s. „Senden“). **Termin-Ansicht** (E6-1b): Zeile in „Termine“,
> „Ablauf & Dienste“ auf der Startseite oder der Name im Spaltenkopf von „Planen“ → Ablauf wie in der Musik-App
> (Dauer neben der Zeit) und die Dienste des Termins, ‹ › blättert; nur ansehen (Bearbeiten ab E6-3). **Planen**:
> Termine als Spalten, Dienstgruppen und Dienste als Zeilen, in jeder Zelle die Plätze (Gruppen, in denen man nicht
> einteilen darf: „nur ansehen“); freien Platz antippen →
> „Wer kann?“ (E4-2) und dort **als Entwurf eintragen** (E4-3, Person oder Gast; Entwurf antippen = ändern oder entfernen, veraltete mit Schild); belegten Platz antippen → **zurückziehen oder ersetzen** (E4-5, ebenfalls als Entwurf); Regler in der Gruppenzeile → **Anzahl der Plätze** je Termin (sofort); **Zauberstab** in der Gruppenzeile bzw. im Gruppenkopf → Vorschläge nach der ChurchTools-Rangfolge zum Prüfen, übernommen als Entwurf (E5); **Stift** neben einem Namen (Zauberstab, „Wer kann?“) → Vorlieben der Person für die Gruppe, sofort in ChurchTools (E5); unten **„Ansehen und senden“** (E4-4): Anfrage, direkt zuteilen, Gast eintragen, zurückziehen; Zeitraum wählen (ab heute, ein Monat oder von–bis), Terminleiste,
> Spaltenbreite, Filter nach Veranstaltung und Gruppe, „Wer wie oft?“; am Handy ein Termin auf einmal. **Start**: „Als
> Nächstes“ (dein Dienst, Team, Lieder, Musik-App), deine offenen Anfragen, deine nächsten Dienste,
> Abwesenheiten und für Planer die freien Plätze der nächsten 6 Wochen. Die Reiter
> Start · Termine · Planen · Abwesenheiten stehen (am Computer oben, am Handy unten; „Planen“ nur für
> Planer). **Termine**: Liste nach Monaten, „Meine | Alle“, Filter nach Veranstaltung (aus den
> Terminnamen), die eigenen Dienste (zugesagt/angefragt), für Planer die freien Plätze ihrer
> Dienstgruppen. Zauberstab und Abwesenheiten folgen (Bauplan E5–E9). Hell oder dunkel wie in ChurchTools gewählt (seit 15.10.2026). Diese Anleitung wächst mit.

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
| Ablauf-Pflege                     | Abläufe bearbeiten (ab E6)       | Recht „Ablauf bearbeiten“ für den Kalender                           |
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

**Den Menüpunkt sehen:** Erweiterung **„Dienstplaner“ sehen** – für alle, die Dienste haben. Ohne dieses
Recht zeigt ChurchTools selbst „Keine ausreichende Berechtigung“.

**Was in der Matrix steht** (Prüfung mit drei Rollen, 13.10.2026, #525): ChurchTools liefert die Plätze
einer Dienstgruppe nur dann **vollständig**, wenn die Dienstgruppe „für alle sichtbar“ ist, man sie sehen
oder bearbeiten darf oder eine Gruppe des Dienstes leitet. Sonst kommen nur die **eigenen** Einträge. Die
Matrix und „Wer wie oft?“ zeigen deshalb nur vollständig gelieferte Dienste (`siehtDienstGanz`), denn eine
halbe Zeile sähe aus wie „nicht vorgesehen“. Die eigenen Dienste stehen immer unter Start und Termine.

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
- Ansehen ohne ChurchTools: `npm run dev -w dienstplaner`, dann
  `http://localhost:5178/ccm/dienstplaner/?demo` (`?demo=mitglied`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `dienstplan-vX.Y.Z` → `dienstplaner-release.yml` → gemeinsame Vorlage
  `erweiterung-release.yml` (**nie „latest"** – sonst sähen die Musik-Apps keinen Update-Hinweis mehr).
- Bauplan und Entwurf: `~/ecg-donrath/gemeinde-apps/dienstplaner-planung/docs/bauplan.md` (außerhalb des Repos).
