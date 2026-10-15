# Dienstplaner – ChurchTools-Erweiterung

> **Stand: E3 fertig (14.10.2026)** – mit drei Rollen geprüft (Test-Instanz) und lesend an der Live-Instanz. Die Erweiterung startet in ChurchTools – **nur lesen**. **Planen**:
> Termine als Spalten, Dienstgruppen und Dienste als Zeilen, in jeder Zelle die Plätze; freien Platz antippen →
> „Wer kann?“ (E4-2) und dort **als Entwurf eintragen** (E4-3, Person oder Gast – noch ohne Anfrage; Entwurf antippen = ändern oder entfernen, veraltete mit Schild, Leiste „N noch nicht gesendet“); Zeitraum wählen (ab heute, ein Monat oder von–bis), Terminleiste,
> Spaltenbreite, Filter nach Veranstaltung und Gruppe, „Wer wie oft?“; am Handy ein Termin auf einmal. **Start**: „Als
> Nächstes“ (dein Dienst, Team, Lieder, Musik-App), deine offenen Anfragen, deine nächsten Dienste,
> Abwesenheiten und für Planer die freien Plätze der nächsten 6 Wochen. Die Reiter
> Start · Termine · Planen · Abwesenheiten stehen (am Computer oben, am Handy unten; „Planen“ nur für
> Planer). **Termine**: Liste nach Monaten, „Meine | Alle“, Filter nach Veranstaltung (aus den
> Terminnamen), die eigenen Dienste (zugesagt/angefragt), für Planer die freien Plätze ihrer
> Dienstgruppen. Einteilen und Abwesenheiten folgen (Bauplan E4–E9). Hell oder dunkel wie in ChurchTools gewählt (seit 15.10.2026). Diese Anleitung wächst mit.

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
einzelner Termine ist, sieht das an diesen Terminen. „Planen“ heißt bis E4 nur ansehen – eingeteilt wird
noch in ChurchTools.

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
- Ansehen ohne ChurchTools: `npm run dev -w dienstplaner`, dann
  `http://localhost:5178/ccm/dienstplaner/?demo` (`?demo=mitglied`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `dienstplan-vX.Y.Z` → `dienstplaner-release.yml` → gemeinsame Vorlage
  `erweiterung-release.yml` (**nie „latest"** – sonst sähen die Musik-Apps keinen Update-Hinweis mehr).
- Bauplan und Entwurf: `~/ecg-donrath/gemeinde-apps/dienstplaner-planung/docs/bauplan.md` (außerhalb des Repos).
