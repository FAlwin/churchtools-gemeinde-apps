# Sitzungen – ChurchTools-Erweiterung

> **Stand: S1 (22.10.2026)** – Grundgerüst. Die Erweiterung zeigt, wer angemeldet ist, und **„Deine Gruppen“** mit
> dem Stand der Einrichtung (eingerichtet · unvollständig · nicht eingerichtet). Protokolle, To-Dos, Termine und
> das Einrichten selbst folgen (Bauplan S2–S9 in `sitzungen-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

Die Sitzungen sind für Gruppen wie den Leitungskreis: **Protokolle als Dokument** (wie Word, Loop oder Notion),
daraus gesammelt Beschlüsse, To-Dos und Termine. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server,
keine Push-Mitteilungen und keine eigenen Mails.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`sitzungen-v….zip`** herunterladen (nicht entpacken). Die Releases heißen „Sitzungen v…“ – nicht verwechseln
   mit den Releases der Musik App, der Anmeldungen oder des Dienstplaners.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Sitzungen“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`sitzungen`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/sitzungen/`); mit einem
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
  **Admin** – deshalb wird jede Gruppe einmal von einem Admin eingerichtet (kommt mit S2: „Gruppe einrichten“ in
  der Erweiterung, ein Klick).
- **Versteckte Gruppen** bleiben versteckt; ihre Mitglieder bekommen beim Einrichten zusätzlich „versteckte Gruppe
  sehen“. Ohne das sehen sie ihre eigene Gruppe in ChurchTools nicht (gemessen 22.10.2026).

| Stand auf der Startseite   | Bedeutung                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| eingerichtet               | beide Kategorien der Gruppe sind sichtbar                         |
| unvollständig eingerichtet | nur die Protokoll-Kategorie ist sichtbar – Einrichten wiederholen |
| nicht eingerichtet         | die Gruppe nutzt die Sitzungen noch nicht                         |

## Für Entwickler

- Regeln (ohne Oberfläche, getestet): `shared/sitzungen/` – Dokument und Ableitung (`dokument.ts`), Speicher mit
  Kopf und gepackten Teilen (`speicher.ts`), To-Dos (`aufgaben.ts`), Einrichten (`einrichten.ts`), Vorlagen
  (`vorlagen.ts`), Namen für die KI (`platzhalter.ts`), Meine Gruppen (`gruppen.ts`).
- Erweiterung: `sitzungen/` (`npm run dev -w sitzungen`, dann `http://localhost:5192/ccm/sitzungen/?demo`;
  weitere Fälle `?demo=leer`, `?demo=ohne-modul`, `?demo=fehler`).
- Release: Tag `sitzungen-vX.Y.Z` (Workflow `sitzungen-release.yml`, immer `make_latest: false`).
