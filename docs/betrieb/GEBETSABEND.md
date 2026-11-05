# Gebetsabend – ChurchTools-Erweiterung

> **Stand: G2 (05.11.2026)** – Die Erweiterung lässt sich installieren und **einrichten** (legt ihre zwei Kategorien
> an). Danach zeigt sie den **nächsten Termin** und **„Gebetsabend zuhören“**. **Übertragen starten und beenden (G3)
> und „Wer hört zu?“ (G4) folgen** (Bauplan `gebetsabend-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

Der Gebetsabend wird für Gemeindeglieder übertragen, die nicht kommen können – mit Bild und Ton, nur für Personen mit
ChurchTools-Zugang und Recht an der Erweiterung. Übertragen wird mit **VDO.Ninja** (Peer-to-Peer im Browser) im
eingebetteten Fenster; einen Link zum Weitergeben gibt es nicht. Es gibt **keinen eigenen Server**.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`gebetsabend-v….zip`** herunterladen (nicht entpacken). Die Releases heißen „Gebetsabend v…“ – nicht verwechseln
   mit den Releases der anderen Apps.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Gebetsabend“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`gebetsabend`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/gebetsabend/`); mit
     einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern. ChurchTools speichert die
Dateien einer Erweiterung **7 Tage** im Browser zwischen (gemessen 05.11.2026); die Erweiterung hat deshalb Dateinamen
mit Fingerabdruck – unten auf der Seite steht die Version, daran erkennt man, welche gerade läuft.

## Einrichten

Einmal, von jemandem mit dem Recht **„Kategorien erstellen“** bei der Erweiterung (z. B. ein Admin): die Erweiterung
öffnen → **Einrichten**. Dabei entstehen zwei Kategorien im Speicher der Erweiterung:

- **„Gebetsabend: Zugang“** (Kürzel `zugang`) – Zugangsdaten der laufenden Übertragung (wechseln bei jedem Start).
- **„Gebetsabend: Einstellungen“** (Kürzel `einstellungen`) – der Kalender des Gebetsabends.

Erst danach lassen sich die Rechte auf diese Kategorien vergeben (vorher stehen sie nicht zur Auswahl).

## Zuhören

Die Seite zeigt oben den **nächsten Gebetsabend** aus dem gewählten Kalender (Titel enthält „Gebet“; einstellbar mit G3)
und darunter einen großen Knopf **„Gebetsabend zuhören“**:

- **Noch keine Übertragung:** Der Knopf ist aus, darüber steht, dass es kurz vor dem Gebetsabend losgeht. Die Seite
  fragt alle 20 Sekunden nach und schaltet den Knopf von selbst frei – Neuladen ist nicht nötig.
- **Läuft:** Ein Tippen öffnet Bild und Ton (ohne Bedienelemente von VDO.Ninja). Am iPhone sperrt
  Safari das Abspielen im eingebetteten Fenster manchmal, bis man selbst ins Bild tippt – dann zeigt das Bild einen
  Wiedergabe-Knopf, und darunter steht „Bleibt das Bild schwarz? Einmal ins Bild tippen.“ Unter dem Bild steht, was gerade
  passiert („Verbindet …“, „Der Ton kommt an.“, „Kurz unterbrochen – verbindet von selbst wieder …“). Der Ton läuft auch
  bei gesperrtem Handy weiter (gemessen an iPhone und iPad).
- **Neu gestartet / beendet:** Startet die Technik neu, lädt der Player die neuen Daten selbst; beendet sie, schließt
  er sich mit „Die Übertragung ist beendet“. Antwortet ChurchTools dabei kurz nicht, bleibt alles, wie es ist.
- Zuhörer melden sich beim Sender mit **Vor- und Nachnamen** an – die Technik sieht später, wer zuhört (G4).

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren Sitzung.
Vergeben werden die Rechte unter **Administration → Berechtigungen**: für die Zuhörer über den **Status** (z. B.
„Mitglied“), für die Technik über die **Technik-Gruppe**. **Diese Tabelle ist die eine Stelle für alle Rechte des
Gebetsabends**; braucht eine neue Funktion ein Recht, kommt es hier dazu.

| Recht                                                                      | Zuhörer (z. B. Status „Mitglied“) |         Technik-Gruppe          |
| -------------------------------------------------------------------------- | :-------------------------------: | :-----------------------------: |
| „Gebetsabend“ sehen (`view`)                                               |                 ✓                 |                ✓                |
| Kategorien sehen (`view custom category`): Zugang, Einstellungen           |                 ✓                 |                ✓                |
| Daten in Kategorie sehen (`view custom data`): Zugang, Einstellungen       |                 ✓                 |                ✓                |
| Daten in Kategorie erstellen (`create custom data`): Zugang, Einstellungen |                 –                 |                ✓                |
| Daten in Kategorie bearbeiten (`edit custom data`): Zugang, Einstellungen  |                 –                 |                ✓                |
| Daten in Kategorie löschen (`delete custom data`): Zugang, Einstellungen   |                 –                 |                ✓                |
| Kategorien erstellen (`create custom category`)                            |                 –                 | einmalig zum Einrichten (Admin) |
| Kalender des Gebetsabends sehen                                            |                 ✓                 |                ✓                |

> **Den Unterpunkt „-- Alle --“ nirgends anhaken** – er gilt sonst auch für jede künftige Kategorie. Wer „Zugang“
> bearbeiten darf, kann die Übertragung beenden oder umleiten – deshalb nur die Technik.

**Gemessen (05.11.2026, Test-Instanz):** Ohne „Gebetsabend sehen“ sperrt ChurchTools die Seite selbst („Keine
ausreichende Berechtigung“); die Erweiterung fehlt dann auch in der Modul-Liste. Ohne Kategorie-Recht liefert
ChurchTools eine leere Liste und beim Direktzugriff auf die Werte per ID **403**. Einfache Mitglieder sehen die
öffentlichen Kalender, nicht interne wie „Gemeindeleitung“ – der Gebetsabend gehört in einen Kalender, den Mitglieder
sehen.

**Zur Sicherheit:** Wer zuhören darf, könnte die Zugangsdaten technisch auslesen und weitergeben. Jeder Start setzt
deshalb neue Daten – ein weitergegebener Link gilt höchstens einen Abend. Bild und Ton laufen direkt zwischen den
Geräten; den Verbindungsaufbau (und, wo nötig, die Umleitung) übernehmen Server von VDO.Ninja.

## Für Entwickler

- Regeln (ohne Oberfläche, getestet): `shared/gebetsabend/` – `zugang.ts` (StreamID/Passwort, nur Buchstaben und
  Ziffern), `links.ts` (Sender- und Zuhörer-Adresse, eine Stelle), `zustand.ts` (Player-Zustand aus den
  VDO.Ninja-Meldungen; `istVdoMeldung` nimmt nur Nachrichten aus dem eigenen iframe von `https://vdo.ninja` an),
  `einrichten.ts` (Kategorien, Stand der Einrichtung), `einstellungen.ts` (Kalender, Suchwort), `termin.ts` (nächster
  Termin), `zuhoeren.ts` (Texte, Nachfragen, „neu laden / beendet“).
- Erweiterung: `gebetsabend/` (`npm run dev -w gebetsabend`, dann `http://localhost:5193/ccm/gebetsabend/?demo`;
  Fälle `?demo=zuhoerer`, `?demo=aus`, `?demo=technik`, `?demo=mitglied`, `?demo=fehler`).
- Messungen: `gebetsabend-planung/s0-messung.md` (S0, S0b, G0 – Einbettung, Rechte, VDO.Ninja-Parameter und
  -Meldungen).
- Release: Tag `gebetsabend-vX.Y.Z` (Workflow `gebetsabend-release.yml`, immer `make_latest: false`).
