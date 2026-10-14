# Anmeldungen – ChurchTools-Erweiterung

> **Stand: Formular und Gestaltung (A5).** Die Erweiterung zeigt die Veranstaltungen der eigenen Gruppen;
> Leitung und Organisatoren legen neue an, wählen den Termin, stellen Zeitraum, Plätze, Preise und
> Bankverbindung ein, bauen das Formular, gestalten es und geben frei. Das öffentliche Formular (A6) und
> die Anmeldungsliste (A7) folgen. Diese Anleitung wächst mit.

Die Anmeldungen ersetzen Jotform & Co.: Veranstalter legen Anmeldungen zu Veranstaltungen selbst an und
verwalten sie in ChurchTools. Teilnehmende melden sich über ein öffentliches Formular an und können
selbst ändern oder absagen. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server.

Sie besteht aus zwei Teilen:

|              | **Erweiterung** (für das Team)              | **Formular** (für Teilnehmende)                                 |
| ------------ | ------------------------------------------- | --------------------------------------------------------------- |
| Wo           | Menüpunkt in ChurchTools                    | eine Adresse für alle Gemeinden (GitHub Pages des Projekts)     |
| Anmelden     | Wer in ChurchTools angemeldet ist, ist drin | ohne Konto; ändern und absagen über den Link in der Bestätigung |
| Installieren | ZIP hochladen (unten)                       | nichts – ab A6: eine Adresse als erlaubte Herkunft eintragen    |

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

## Preise und Bezahlung

- **Preise** stellt die Leitung auf der Seite der Veranstaltung ein. Gerechnet wird immer in derselben
  Reihenfolge: Grundpreis → Alter → Rabatte und Zuschläge → Extras. Mit **„Probe rechnen“** prüft man an
  einer Beispielfamilie, ob herauskommt, was man erwartet; das Formular rechnet genauso.
- **Preise nach Alter** brauchen das Geburtsdatum (unter „Wer meldet sich an?“). Gezählt wird das Alter am
  ersten Tag der Veranstaltung.
- **Preise ändern** geht auch, wenn es schon Anmeldungen gibt. Wer angemeldet ist, behält seinen Betrag.
- **Bankverbindung:** je Veranstaltung („wie eine frühere“ übernimmt sie). Sie steht im öffentlichen
  Formular und in der Bestätigung, ist also **ohne Anmeldung lesbar**. Bitte nur das Konto der Gemeinde
  eintragen. Im Verwendungszweck wird `[Nachname]` durch den Nachnamen ersetzt.

## Formular und Gestaltung

- **Reiter „Formular“** – der Baukasten. In der Mitte steht das Formular so, wie Gäste es sehen; rechts die
  Leiste mit **Bausteine** und **Design**.
  - **Hinzufügen:** einen Baustein an die richtige Stelle ins Formular ziehen oder antippen (er landet unter
    dem gewählten Feld). Empfohlene Bausteine (Geburtsdatum, Telefon, Anschrift …) gibt es je einmal; ist
    einer schon im Formular, ist seine Kachel grau.
  - **Bearbeiten:** ein Feld anklicken – Frage, Hilfetext, Antworten und „Pflicht“ stehen direkt im Feld.
    Verschieben am Griff links oder mit den Pfeilen, kopieren und entfernen oben rechts am Feld.
  - **Kopf:** Name und Begrüßungstext direkt anklicken; „Titelbild ändern“ (und entfernen) steht im Bild. Das
    Titelbild ist das Gruppenbild in ChurchTools und öffentlich sichtbar.
  - **Design:** Vorlage, Farbe, Feldstil, Knöpfe, Gemeindename – man sieht es sofort im Formular. Oben
    „Computer/Handy“ und „Vorschau“ (zum Ausprobieren, ohne Bearbeiten).
  - **Gespeichert wird von selbst**; oben steht, ob gerade gespeichert wird, und bei einem Fehler „Nochmal“.
    Nach jeder Änderung bietet die Leiste oben „Rückgängig“ an (nicht beim Titelbild).
  - Jedes Feld außer Name, E-Mail und Geburtsdatum wird in ChurchTools eine **Spalte der Mitgliederliste**
    (Sicherheitsstufe 3 – das Team sieht die Antworten). Hat schon jemand geantwortet, wird ein Feld oder
    eine Antwort beim Entfernen nur **ausgeblendet**; die Antworten bleiben, und unter „Ausgeblendet“ lässt
    sich das Feld zurückholen. Überschrift, Hinweistext und Trennlinie sind nur Text, ohne Spalte.
  - Ziehen geht mit der Maus (es öffnet sich eine Lücke, wo der Baustein landet); auf dem Handy Bausteine
    antippen und mit den Pfeilen verschieben. Alles lässt sich verschieben – nur Preisbereich und Datenschutz
    stehen immer direkt vor „Verbindlich anmelden“.
  - **Fragetyp ändern** (unten im gewählten Feld) geht nur, solange niemand geantwortet hat: ChurchTools kann
    den Typ einer Spalte nicht ändern, die Erweiterung legt dafür eine neue an.
  - **Design:** Eine Vorlage (Klassisch, Foto, Einladung, Bunt, Zweigeteilt, Groß und deutlich) ist nur der
    Startpunkt – sie füllt alle Werte. Danach lässt sich alles einzeln ändern: Aufbau, Kopf, Logo, Hintergrund
    (Farbe, Muster, Titelbild), Farben, Schriften, Abschnitte, Eingabefelder, Knopf, Breite. Ein anderer
    Startpunkt setzt alles wieder auf dessen Werte (Logo, Begrüßung und Breite bleiben). Schriften kommen nur
    vom Gerät selbst – nichts wird von Google geladen. Das Titelbild ändert man direkt im Bild.
  - **Logo:** das Gemeindelogo aus ChurchTools (Einstellungen → Allgemein); die Erweiterung übernimmt es beim
    Öffnen des Baukastens. Ist dort keins hinterlegt, gibt es keins. **Oder ein eigenes:** „Eigenes“ zeigt die
    schon hochgeladenen Logos zur Auswahl, dazu „Neues hochladen“. Weil ChurchTools je Gruppe nur ein Bild kennt
    (das Titelbild), liegt jedes eigene Logo als Bild einer **archivierten Hilfsgruppe** „Logo: …“ unter dem
    Team (Gruppenart „Anmeldung“, Beschreibung „Logo für die Anmeldungen. Bitte nicht löschen …“). In der
    Erweiterung tauchen diese Gruppen nicht als Veranstaltung auf. **Wird so eine Gruppe in ChurchTools
    gelöscht, fehlt das Logo in jedem Formular, das es zeigt.** Entfernen geht in der Leiste nur für
    Gruppen-Admins, mit Warnung; von selbst wird nichts gelöscht (Kopien nutzen dasselbe Logo).
- **Wo die Einstellungen stehen:** in der Beschreibung der Gruppe, unsichtbar unter dem Satz „Diese
  Anmeldung wird mit der Erweiterung **Anmeldungen** verwaltet.“ Wer den Text in ChurchTools ändert,
  schadet nicht: Die Erweiterung stellt die Einstellungen aus ihrer Sicherung wieder her (in den
  Beschreibungen der Felder „Betrag“, „Bezahlt“ …) und behält den neuen Text.

## Umbenennen, verschieben, löschen

- **„Verwalten“** oben auf der Seite einer Veranstaltung: umbenennen, Freigabe zurücknehmen, in ein
  anderes Team verschieben, löschen. Nach jeder Änderung – auch nach dem Speichern eines Fensters – steht
  oben **„Rückgängig“**. Steht der Name im Verwendungszweck, zieht er beim Umbenennen und bei „wie eine
  frühere“ mit; der Titel des Kalendertermins bleibt, wie er ist.
- **Löschen schiebt ins Archiv.** Die Veranstaltung verschwindet aus der Liste, Gäste können sich nicht
  mehr anmelden, die Anmeldungen bleiben. Unter **„Gelöschte Veranstaltungen (Archiv)“** auf der
  Startseite lässt sie sich wiederherstellen (als Entwurf).
- **Endgültig löschen** (mit allen Anmeldungen, nicht umkehrbar) geht nur aus dem Archiv und nur für
  **Gruppen-Admins** – ebenso das Verschieben in ein anderes Team. Das legt ChurchTools so fest.

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
