# Anmeldungen – ChurchTools-Erweiterung

> **Stand: Grundgerüst (A1).** Die Erweiterung zeigt bisher nur, wer angemeldet ist und in welchen
> Gruppen. Veranstaltungen, Formular und Teilnehmerlisten folgen Schritt für Schritt (Bauplan A2–A10).
> Diese Anleitung wächst mit.

Die Anmeldungen ersetzen Jotform & Co.: Veranstalter legen Anmeldungen zu Veranstaltungen selbst an und
verwalten sie in ChurchTools. Teilnehmende melden sich über ein öffentliches Formular an und können
selbst ändern oder absagen. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server.

Sie besteht aus zwei Teilen:

|              | **Erweiterung** (für das Team)              | **Formular** (für Teilnehmende)                                 |
| ------------ | ------------------------------------------- | --------------------------------------------------------------- |
| Wo           | Menüpunkt in ChurchTools                    | eine Adresse für alle Gemeinden (GitHub Pages des Projekts)     |
| Anmelden     | Wer in ChurchTools angemeldet ist, ist drin | ohne Konto; ändern und absagen über den Link in der Bestätigung |
| Installieren | ZIP hochladen (unten)                       | nichts – ab A4: eine Adresse als erlaubte Herkunft eintragen    |

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`anmeldungen-v….zip`** herunterladen (nicht entpacken). Die Anmelde-Releases heißen „Anmeldungen
   v…" – nicht verwechseln mit den Releases der Musik App.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Anmeldungen" – so heißt der Menüpunkt.
   - **Kürzel:** genau **`anmeldungen`**. Die Erweiterung ist für diese Adresse gebaut
     (`/ccm/anmeldungen/`); mit einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit
deren Sitzung. Für das Grundgerüst braucht es **keine besonderen Rechte**: die eigene Person, die eigenen
Gruppen und die Gruppenrollen kann jede angemeldete Person lesen (gemessen an der Test-Instanz mit einem
Konto ohne Admin-Rechte, 12.10.2026).

Später gilt (Bauplan §2): **Jede Veranstaltung gehört zu einer Gruppe.** Mitglieder der Gruppe legen
Anmeldungen an, die Leitung gibt sie frei, die ganze Gruppe bearbeitet die Anmeldungen. Welche Rechte
dafür genau nötig sind, steht hier, sobald es gemessen ist.

## Für Entwickler

- Code: `anmeldungen/` (Erweiterung), `formular/` (öffentliche Seite), Regeln in `shared/anmeldung/`,
  ChurchTools-Verbindung in `ui/ct/`.
- Ansehen ohne ChurchTools: `npm run dev -w anmeldungen`, dann
  `http://localhost:5176/ccm/anmeldungen/?demo` (`?demo=leer`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `anmeldung-vX.Y.Z` (Workflow `anmeldungen-release.yml`, **nie „latest"** – sonst sähen
  die Musik-Apps einen falschen Update-Hinweis).
- Formular veröffentlichen: Workflow `formular-pages.yml`, vorerst nur von Hand; GitHub Pages muss dafür in
  den Repo-Einstellungen eingeschaltet sein.
