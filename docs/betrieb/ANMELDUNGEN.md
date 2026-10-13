# Anmeldungen – ChurchTools-Erweiterung

> **Stand: Anlegen und Einrichten (A3).** Die Erweiterung zeigt die Veranstaltungen der eigenen Gruppen;
> Leitung und Organisatoren legen neue an (Vorlage oder „wie eine frühere“), wählen oder legen den Termin im
> Kalender an, stellen Zeitraum, Plätze und Warteliste ein und geben frei. Preise (A4), Formular und
> Gestaltung (A5), das öffentliche Formular (A6) und die Anmeldungsliste (A7) folgen. Diese Anleitung wächst mit.

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

## In ChurchTools einrichten

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit
deren Sitzung. **Jede Veranstaltung ist eine Untergruppe der Gruppe, die sie anbietet** (z. B.
„Gemeindeessen“ unter dem Team, das es organisiert), von der eigenen Gruppenart **„Anmeldung“**. Damit
regelt ChurchTools selbst, wer was darf:

| Wer im Team                    | Anmeldung anlegen        | Einrichten und freigeben | Termin im Kalender anlegen        | Anmeldungen bearbeiten                                           |
| ------------------------------ | ------------------------ | ------------------------ | --------------------------------- | ---------------------------------------------------------------- |
| Leiter, Co-Leiter, Organisator | ✅ (nur Art „Anmeldung“) | ✅                       | ✅ in den freigegebenen Kalendern | ✅                                                               |
| Mitarbeiter                    | –                        | –                        | –                                 | ✅ „bezahlt“, Warteliste, nachrücken, absagen, von Hand anmelden |

So an der Test-Instanz eingestellt und gemessen (12.10.2026). Admins dürfen ohnehin alles.

### 1. Gruppenart „Anmeldung“ anlegen (einmal je Gemeinde)

**Gruppen → Einstellungen → Gruppentypen → Gruppentyp hinzufügen:** Einzahl **Anmeldung**, Mehrzahl
**Anmeldungen**, Kürzel **AN**, Farbe frei, Beschreibung z. B. „Liste der Anmeldungen zu einer
Veranstaltung. Liegt unter dem Team, das sie anbietet.“ – _Leitung muss vorhanden sein_, _In „Neue Person
erstellen“ aufnehmen_ und _Beiträge aktivieren_ **aus**. Rollen: **Teilnehmer** (Standardrolle) und
**Leiter** (legt ChurchTools selbst an). Die Erweiterung findet die Art über den Namen „Anmeldung“.

Veranstaltungen **ohne** Anmeldung brauchen diese Art nicht – sie bleiben Termine (oder Gruppen anderer Art).

### 2. Anlegen erlauben (je Gruppe, die Veranstaltungen anbietet)

Rechteverwaltung → Reiter **„Gruppe“** → Gruppe wählen → **Gruppeninterne Berechtigungen** →
„Personen und Gruppen“ → Zeile **„Untergruppen erstellen und kopieren“**: bei **Leiter, Co-Leiter und
Organisator** nur **„Anmeldung“** auswählen (nicht „Alle“). Mitarbeiter bleiben bei „Keine“.

### 3. Rechte in den Veranstaltungen (je Gruppe)

Dieselbe Seite, ganz unten **„Berechtigung für die Untergruppen“** → _Wie viele Ebenen…_: **Eine Ebene
von Untergruppen** → bei „Personen und Gruppen“:

- **Mitarbeiter:** Gruppeninfos sehen, Gruppenmitglieder sehen, Gruppenmitgliedsfelder sehen,
  Gruppenmitgliedsfelder bearbeiten – jeweils **Stufe 3 (Hoch)** (damit das Team auch z. B. Allergien sieht);
  Gruppenmitgliedschaften bearbeiten, Gruppenmitglieder hinzufügen, Gruppenmitglieder entfernen ✅; alles
  andere **leer**.
- **Organisator** (wie die Leitung): dieselben vier mit Stufe 3, dazu ✅ Gruppeninfos bearbeiten,
  Grundeinstellungen bearbeiten, Gruppenmitgliedsfelder verwalten, Gruppenmitgliedschaften bearbeiten,
  hinzufügen, entfernen, Routinen verwalten.
- Die **Leitung** hat das bei der ECG schon über den Gruppentyp „Dienst“ (orange markiert).

„Grundeinstellungen bearbeiten“ ist in ChurchTools **ein** Schalter für Plätze, Anmeldezeitraum **und**
Status – wer eine Veranstaltung einrichten darf, darf sie also auch freigeben.

Fehlt Schritt 3, zeigt die Startseite bei der Gruppe „Untergruppen für dich nicht freigegeben“ statt die
Veranstaltungen stillschweigend wegzulassen.

### 4. Kalender (je Gruppe)

Der Termin kommt immer aus dem Kalender; fehlt er, legt die Erweiterung ihn an – mit dem Link zur
Anmeldung. Dafür: Dieselbe Seite, Kasten **„Globale Berechtigungen durch Gruppenzugehörigkeit“** → in den
Spalten **Leiter, Co-Leiter, Organisator** je auf **„Bearbeiten“** → **Kalender** → **„In einzelnen Kalendern
Termine erstellen, bearbeiten etc. (edit category)“** → die Kalender anhaken, in die dieses Team
Termine stellen darf (nicht „-- Alle --“). Danach steht unter der Spalte „Kalender: edit category (…)“.

Die Erweiterung bietet beim Anlegen genau diese Kalender an. Fehlt das Recht, meldet ChurchTools übrigens
401 statt 403 – die Erweiterung sagt dann, dass ChurchTools es nicht erlaubt, und an wen man sich wendet.

In **vorhandene** Termine trägt die Erweiterung nichts ein (ChurchTools ersetzt einen Termin beim Ändern
ganz – Räume, Dienste oder Bild gingen verloren); dort steht „Link zur Anmeldung kopieren“.

### 5. Den Menüpunkt sehen

Erweiterung **„Anmeldungen“ sehen** (`view`, Bereich „anmeldungen“ in den Berechtigungen) – für alle, die
mitarbeiten (z. B. über den Status oder global über die Gruppen).

## Für Entwickler

- Code: `anmeldungen/` (Erweiterung), `formular/` (öffentliche Seite), Regeln in `shared/anmeldung/`,
  ChurchTools-Verbindung, Anmeldung und Fehlertexte in `ui/ct/`, Seitenrahmen in `ui/erweiterung/` –
  dieselben wie beim Dienstplaner.
- Ansehen ohne ChurchTools: `npm run dev -w anmeldungen`, dann
  `http://localhost:5176/ccm/anmeldungen/?demo` (`?demo=leer`, `?demo=fehler` für die Sonderfälle).
- Release: Tag `anmeldung-vX.Y.Z` (Workflow `anmeldungen-release.yml`, **nie „latest"** – sonst sähen
  die Musik-Apps einen falschen Update-Hinweis).
- Formular veröffentlichen: Workflow `formular-pages.yml`, vorerst nur von Hand; GitHub Pages muss dafür in
  den Repo-Einstellungen eingeschaltet sein.
