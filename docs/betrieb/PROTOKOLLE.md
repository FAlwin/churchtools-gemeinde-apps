# Protokolle – ChurchTools-Erweiterung

> **Stand: S1 (22.10.2026)** – Grundgerüst. Die Erweiterung zeigt, wer angemeldet ist, und **„Deine Gruppen“** mit
> dem Stand der Einrichtung (eingerichtet · unvollständig · nicht eingerichtet). Protokolle, To-Dos, Termine und
> das Einrichten selbst folgen (Bauplan S2–S9 in `protokolle-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

Die Protokolle sind für Gruppen wie den Leitungskreis: **Protokolle als Dokument** (wie Word, Loop oder Notion),
daraus gesammelt Beschlüsse, To-Dos und Termine. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server,
keine Push-Mitteilungen und keine eigenen Mails.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`protokolle-v….zip`** herunterladen (nicht entpacken). Die Releases heißen „Protokolle v…“ – nicht verwechseln
   mit den Releases der Musik App, der Anmeldungen oder des Dienstplaners.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Protokolle“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`protokolle`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/protokolle/`); mit einem
     anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren
Sitzung. **Ein eigenes Rechte-System gibt es nicht.** Protokolle sind vertraulich und werden von ChurchTools selbst
geschützt, nicht nur in der Oberfläche (gemessen 16.10.2026):

- Je Gruppe gibt es zwei Kategorien im Speicher der Erweiterung: **„Protokolle · <Gruppe>“** (Kürzel
  `protokolle-g<ID>`, nur die Leitung schreibt) und **„Mitarbeit · <Gruppe>“** (`mitarbeit-g<ID>`, To-Dos und
  Vorschläge). Dazu gemeinsam **„Vorlagen“** (`vorlagen`).
- Die Rechte hängen an **„Rolle X in Gruppe Y“** und folgen einem Rollenwechsel sofort. Setzen kann sie nur ein
  **Admin** (ChurchTools-Recht „Personen administrieren“) – deshalb wird jede Gruppe einmal von einem Admin
  eingerichtet: Reiter **„Verwaltung“** (nur für Admins sichtbar) → Gruppe antippen → je Rolle „Kein Zugriff“,
  „Lesen + eigene To-Dos“ oder „Leitung“, dazu „Vorschlagen“/„Direkt eintragen“ und der Kalender → **Einrichten**.
  Das dauert einige Sekunden (jeder Schritt wird nachgelesen); scheitert es, bleibt das Fenster offen und sagt warum.
- Beim Einrichten bekommt jede Rolle mit Zugriff: „Modul sehen“, Lesen in allen drei Kategorien, Schreiben in
  „Mitarbeit“; die **Leitung** zusätzlich Schreiben und Löschen in „Protokolle“ und „Termine bearbeiten“ im gewählten
  Kalender (alle anderen: „ansehen“). Gelöscht wird in „Mitarbeit“ nie – ein To-Do wird nur als gelöscht markiert.
- Wird eine Rolle herabgestuft, entzieht das Einrichten die Rechte auf die eigenen Kategorien **sofort wirksam**.
  Kalender-Rechte und „versteckte Gruppe sehen“ entzieht es nur, wenn die Verwaltung sie **selbst gesetzt** hat
  (sie merkt sich das in der Einstellung der Gruppe); was ein Admin vorher von Hand gesetzt hatte, bleibt.
- **Versteckte Gruppen** bleiben versteckt; ihre Mitglieder bekommen beim Einrichten zusätzlich „versteckte Gruppe
  sehen“. Ohne das sehen sie ihre eigene Gruppe in ChurchTools nicht (gemessen 22.10.2026).

**Vorlagen** (Reiter „Verwaltung“, Karte „Vorlagen“): gelten für alle Gruppen. Beim ersten Einrichten einer Gruppe
entstehen drei zum Anpassen (Leitungssitzung, Teamtreffen, Klausur). Je Vorlage: Name, Tagesordnungspunkte mit
vorbereitetem Text, feste Punkte („Offene To-Dos“, „Protokoll der letzten Sitzung“ – füllen sich selbst) und feste
Aufgaben, die bei jeder Sitzung mit dieser Vorlage angelegt werden. Lesen dürfen sie alle eingerichteten Gruppen,
ändern nur Admins.

| Stand auf der Startseite   | Bedeutung                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| eingerichtet               | beide Kategorien der Gruppe sind sichtbar                         |
| unvollständig eingerichtet | nur die Protokoll-Kategorie ist sichtbar – Einrichten wiederholen |
| nicht eingerichtet         | die Gruppe nutzt die Protokolle noch nicht                        |

## Für Entwickler

- Regeln (ohne Oberfläche, getestet): `shared/protokolle/` – Dokument und Ableitung (`dokument.ts`), Speicher mit
  Kopf und gepackten Teilen (`speicher.ts`), To-Dos (`aufgaben.ts`), Einrichten (`einrichten.ts`), Vorlagen
  (`vorlagen.ts`), Namen für die KI (`platzhalter.ts`), Meine Gruppen (`gruppen.ts`).
- Erweiterung: `protokolle/` (`npm run dev -w protokolle`, dann `http://localhost:5192/ccm/protokolle/?demo`;
  weitere Fälle `?demo=leer`, `?demo=ohne-modul`, `?demo=fehler`).
- Release: Tag `protokolle-vX.Y.Z` (Workflow `protokolle-release.yml`, immer `make_latest: false`).
