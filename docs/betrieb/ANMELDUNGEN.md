# Anmeldungen – ChurchTools-Erweiterung

> **Stand: Startseite (A2).** Die Erweiterung zeigt die Veranstaltungen der eigenen Gruppen mit Stand
> und Belegung und was Aufmerksamkeit braucht – **nur lesen**. Anlegen und Bearbeiten (A3), Formular und
> Teilnehmerlisten folgen Schritt für Schritt (Bauplan A3–A10). Diese Anleitung wächst mit.

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
deren Sitzung.

**Jede Veranstaltung ist eine Untergruppe der Gruppe, die sie anbietet** (z. B. „Gemeindeessen“ unter
dem Team, das es organisiert). Damit regelt ChurchTools selbst, wer was darf:

| Wer                                            | Darf                                                                                                                          | Woher                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Leitung der Gruppe (Leiter, Co-Leiter)         | alles: Anmeldungen, Felder, Einstellungen, freigeben                                                                          | bei Gruppentypen mit „Berechtigung für die Untergruppen“ für die Leitung schon so (bei der ECG: Gruppentyp „Dienst“, 1 Ebene) |
| alle anderen in der Gruppe (z. B. Mitarbeiter) | Anmeldungen sehen und bearbeiten: „bezahlt“, Warteliste, nachrücken, absagen, von Hand anmelden – **nicht** die Einstellungen | **muss eingestellt werden**, siehe unten                                                                                      |

**Einstellen (einmal je Gruppe, die Veranstaltungen anbietet):** Rechteverwaltung → Reiter **„Gruppe“** →
Gruppe wählen → ganz unten **„Berechtigung für die Untergruppen“** → _Wie viele Ebenen…_: **Eine Ebene
von Untergruppen** → bei **„Personen und Gruppen“** für die Rolle **Mitarbeiter**:

- Gruppeninfos sehen, Gruppenmitglieder sehen, Gruppenmitgliedsfelder sehen, Gruppenmitgliedsfelder
  bearbeiten – jeweils **Stufe 3 (Hoch)** (wie die Leitung, damit das Team auch z. B. Allergien sieht)
- Gruppenmitgliedschaften bearbeiten, Gruppenmitglieder hinzufügen, Gruppenmitglieder entfernen ✅
- alles andere **leer** (vor allem nicht: Gruppeninfos/Grundeinstellungen bearbeiten, Gruppenmitgliedsfelder
  verwalten, Routinen verwalten)

So an der Test-Instanz eingestellt und gemessen (12.10.2026): Mitarbeiter sehen und bearbeiten die
Anmeldungen, Name, Status und Felder der Veranstaltung ändern dürfen sie nicht. Fehlt die Einstellung,
zeigt die Startseite bei der Gruppe „Untergruppen für dich nicht freigegeben“ statt die Veranstaltungen
stillschweigend wegzulassen.

**Den Menüpunkt sehen:** Erweiterung **„Anmeldungen“ sehen** – für alle, die mitarbeiten (z. B. über den
Status oder global über die Gruppen).

## Für Entwickler

- Code: `anmeldungen/` (Erweiterung), `formular/` (öffentliche Seite), Regeln in `shared/anmeldung/`,
  ChurchTools-Verbindung in `ui/ct/`.
- Ansehen ohne ChurchTools: `npm run dev -w anmeldungen`, dann
  `http://localhost:5176/ccm/anmeldungen/?demo` (`?demo=leer`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `anmeldung-vX.Y.Z` (Workflow `anmeldungen-release.yml`, **nie „latest"** – sonst sähen
  die Musik-Apps einen falschen Update-Hinweis).
- Formular veröffentlichen: Workflow `formular-pages.yml`, vorerst nur von Hand; GitHub Pages muss dafür in
  den Repo-Einstellungen eingeschaltet sein.
