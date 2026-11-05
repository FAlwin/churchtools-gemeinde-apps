# Gebetsabend – ChurchTools-Erweiterung

> **Stand: G4 (05.11.2026)** – Die Erweiterung lässt sich installieren und **einrichten** (legt ihre zwei Kategorien
> an). Danach zeigt sie den **nächsten Termin** und **„Gebetsabend zuhören“**; die Technik **startet und beendet** die
> Übertragung direkt in der Seite, sieht **wer zuhört** und stellt den Kalender ein. Es folgen die Anleitung für Helfer
> (G5) und der Pilot (G6) (Bauplan `gebetsabend-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

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

Die Seite zeigt eine Karte wie „Als Nächstes“ im Dienstplaner: oben den **nächsten Gebetsabend** aus dem gewählten
Kalender (Titel enthält „Gebet“; die Technik stellt beides unter **„Einstellungen“** neben „Hallo …“ ein), darunter den
Knopf **„Gebetsabend zuhören“**. Ohne passenden Termin steht schlicht „Gebetsabend“ oben. Wer nicht zur Technik
gehört, sieht nur diese eine Karte, schmal in der Mitte:

- **Noch keine Übertragung:** Der Knopf ist aus, darüber steht, dass es kurz vor dem Gebetsabend losgeht. Die Seite
  fragt alle 20 Sekunden nach und schaltet den Knopf von selbst frei – Neuladen ist nicht nötig.
- **Läuft:** Ein Tippen öffnet Bild und Ton (ohne Bedienelemente von VDO.Ninja). Am iPhone sperrt
  Safari das Abspielen im eingebetteten Fenster manchmal, bis man selbst ins Bild tippt – dann zeigt das Bild einen
  Wiedergabe-Knopf, und darunter steht „Bleibt das Bild schwarz? Einmal ins Bild tippen.“ Unter dem Bild steht, was gerade
  passiert („Verbindet …“, „Der Ton kommt an.“, „Kurz unterbrochen – verbindet von selbst wieder …“). Der Ton läuft auch
  bei gesperrtem Handy weiter (gemessen an iPhone und iPad).
- **Vollbild und Bild-in-Bild:** Ein Tippen ins Bild zeigt die Steuerleiste des Geräts – am iPhone Apples eigener
  Player. Dort gibt es **Vollbild** über den ganzen Bildschirm, auch in der ChurchTools-App vom Home-Bildschirm.
  **Bild-in-Bild** (kleines Fenster, während man etwas anderes macht) bietet Apple nur an, wenn ChurchTools in
  **Safari** geöffnet ist – in der App vom Home-Bildschirm sperrt Apple es, das lässt sich nicht einbauen (gemessen
  05.11.2026).
- **Bildqualität:** Der Sender schickt fest **1920×1080** (`&quality=0`), jeder Zuhörer bekommt höchstens **2 Mbit/s**
  Bild. VDO.Ninja passt die Auflösung je Zuhörer an die Playergröße an (im Vollbild mehr) und tastet sich am Anfang
  hoch – die ersten Sekunden sind oft unscharf.
- **Neu gestartet / beendet:** Startet die Technik neu, lädt der Player die neuen Daten selbst; beendet sie, schließt
  er sich mit „Die Übertragung ist beendet“. Antwortet ChurchTools dabei kurz nicht, bleibt alles, wie es ist.
- Zuhörer melden sich beim Sender mit **Vor- und Nachnamen** an – die Technik sieht, wer zuhört (darunter steht „Die
  Technik sieht, dass du zuhörst.“).

## Übertragen (Technik)

Wer zur Technik gehört (die Kategorie „Zugang“ bearbeiten darf), sieht die Seite in **zwei Spalten** wie die Startseite
des Dienstplaners: links die Karte **„Übertragung“** mit dem Kamerabild, rechts „Wer hört zu?“ und den Gebetsabend; am
Handy steht alles untereinander.

- **Starten:** „Bild + Ton“ oder „Nur Ton“ wählen und **„Übertragung starten“** tippen – auf dem Gerät im Raum. Das
  setzt eine neue StreamID und ein neues Passwort, startet den Sender **in der Seite** (Kamerabild in der Karte) und
  meldet allen „läuft“. Erst wenn ChurchTools das nachgelesen bestätigt, startet der Sender; sonst steht da, was
  schiefging. Beim ersten Mal fragt der Browser nach Kamera und Mikrofon – „Erlauben“, am besten dauerhaft.
  Empfohlen wird Chrome auf dem Gerät im Raum. Bei „Nur Ton“ zeigt VDO.Ninja eine Geräteauswahl, dort einmal das
  Mikrofon bestätigen.
- **Seite offen lassen:** Der Sender läuft nur, solange die Seite offen ist und das Gerät nicht gesperrt wird.
- **Seite neu geladen oder anderes Gerät:** Dann steht „Läuft – der Sender ist auf diesem Gerät nicht aktiv“. Die
  Seite startet den Sender **nie von selbst** (sonst könnten zwei Geräte gleichzeitig senden). **„Sender hier
  starten“** nimmt dieselben Zugangsdaten – die Zuhörer bleiben verbunden.
- **Sender neu starten:** lädt den Sender mit demselben Passwort neu, etwa wenn Kamera oder Mikrofon hängen.
- **Übertragung beenden:** mit Rückfrage. Alle Zuhörer werden getrennt; beim nächsten Start gibt es neue Zugangsdaten.
- **Kein Zuhören auf dem Sender-Gerät:** Dort stünde der Ton wieder im Mikrofon – statt des Knopfs steht ein Hinweis.
- **Zwei Geräte gleichzeitig:** Startet oder beendet ein anderes Technik-Gerät inzwischen, wird nichts überschrieben;
  die Seite zeigt, was jetzt gilt. Hat ein anderes Gerät neu gestartet, hört der Sender hier von selbst auf.
- **Wer hört zu?** Eine eigene Karte neben dem Sender zeigt, wer gerade zuhört – Vor- und Nachname aus ChurchTools und seit wann. Wer
  sich still neu verbindet (das iPhone tut das manchmal) oder mit zwei Geräten zuhört, steht einmal da („2 Geräte“).
  **„Ohne Namen“** heißt meist: Jemand hört mit einem weitergegebenen Link zu. Die Liste gibt es nur auf dem Gerät,
  das sendet, und nur solange der Sender dort läuft; gespeichert wird nichts. Den Namen setzt der Zuhörer selbst –
  die Liste ist ein Hinweis, kein Schutz.
- **Einstellungen (Knopf neben „Hallo …“, nur wer „Einstellungen“ bearbeiten darf):** aus welchem Kalender der nächste Termin kommt
  und an welchem Wort im Titel er erkannt wird. Zur Auswahl stehen die Kalender, die man selbst sieht.

Zugang und Einstellungen liegen je als ein Eintrag **mit Versionsnummer** in ihrer Kategorie (wie der Plan im
Organigramm). Ein Eintrag aus G2 (ohne Version, nur in der Test-Instanz) gilt als „noch nichts gespeichert“.

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
  Termin), `zuhoeren.ts` (Texte, Nachfragen, „neu laden / beendet“), `ablage.ts` (Zugang und Einstellungen als Dokument
  mit Version über `@shared/ct/versionierterWert`), `technik.ts` (Technik-Stand „aus / hier / woanders“, wann der Sender
  aufhört, Texte), `werHoert.ts` („Wer hört zu?“ aus den Meldungen des Sender-iframes: je Verbindung, angezeigt je
  Person).
- Erweiterung: `gebetsabend/` (`npm run dev -w gebetsabend`, dann `http://localhost:5193/ccm/gebetsabend/?demo`;
  Fälle `?demo=zuhoerer`, `?demo=aus`, `?demo=technik`, `?demo=mitglied`, `?demo=fehler`).
- Messungen: `gebetsabend-planung/s0-messung.md` (S0, S0b, G0 – Einbettung, Rechte, VDO.Ninja-Parameter und
  -Meldungen).
- Release: Tag `gebetsabend-vX.Y.Z` (Workflow `gebetsabend-release.yml`, immer `make_latest: false`).
