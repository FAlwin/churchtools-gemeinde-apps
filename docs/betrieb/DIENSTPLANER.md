# Dienstplaner – ChurchTools-Erweiterung

> **Stand: Grundgerüst (E2).** Die Erweiterung startet in ChurchTools und zeigt, wer angemeldet ist, die
> eigenen Gruppen und welche Dienstgruppen man laut ChurchTools-Rechten plant – **nur lesen**. Termine,
> Planen und Abwesenheiten folgen Schritt für Schritt (Bauplan E3–E9). Diese Anleitung wächst mit.

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
| Leitung der Gruppe eines Dienstes | diesen Dienst planen (ab E3)     | Rolle mit Leitung in der ChurchTools-Gruppe des Dienstes             |
| Admin eines Termins               | an diesem Termin planen (ab E3)  | als Admin am Termin eingetragen                                      |
| Ablauf-Pflege                     | Abläufe bearbeiten (ab E6)       | Recht „Ablauf bearbeiten“ für den Kalender                           |

Gemessen an der Test-Instanz (08. und 13.10.2026). In E2 zeigt die Startseite nur den ersten Teil
(globales Recht „Dienste einer Dienstgruppe bearbeiten“); Leitung und Termin-Admin hängen am einzelnen
Termin und kommen mit der Terminansicht dazu.

**Den Menüpunkt sehen:** Erweiterung **„Dienstplaner“ sehen** – für alle, die Dienste haben.

## Für Entwickler

- Code: `dienstplaner/` (Erweiterung), Regeln in `shared/ct/` (`dienstRechte.ts`, `dienstgruppen.ts`),
  ChurchTools-Verbindung, Anmeldung und Seitenrahmen in `ui/` (`ui/ct/`, `ui/erweiterung/`) – dieselben
  wie bei den Anmeldungen.
- Ansehen ohne ChurchTools: `npm run dev -w dienstplaner`, dann
  `http://localhost:5178/ccm/dienstplaner/?demo` (`?demo=mitglied`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `dienstplan-vX.Y.Z` → `dienstplaner-release.yml` → gemeinsame Vorlage
  `erweiterung-release.yml` (**nie „latest"** – sonst sähen die Musik-Apps keinen Update-Hinweis mehr).
- Bauplan und Entwurf: `~/ecg-donrath/dienstplaner/docs/bauplan.md` (außerhalb des Repos).
