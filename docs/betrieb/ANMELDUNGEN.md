# Anmeldungen – ChurchTools-Erweiterung

> **Stand: Formular und Gestaltung (A5).** Die Erweiterung zeigt die Veranstaltungen der eigenen Gruppen;
> Leitung und Organisatoren legen neue an, wählen den Termin, stellen Zeitraum, Plätze, Preise und
> Bankverbindung ein, bauen das Formular, gestalten es und geben frei. Das öffentliche Formular (A6) und
> die Anmeldungsliste (A7) folgen. Diese Anleitung wächst mit.

Die Anmeldungen ersetzen Jotform & Co.: Veranstalter legen Anmeldungen zu Veranstaltungen selbst an und
verwalten sie in ChurchTools. Teilnehmende melden sich über ein öffentliches Formular an und können
selbst ändern oder absagen. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server.

Sie besteht aus zwei Teilen:

|              | **Erweiterung** (für das Team)              | **Formular** (für Teilnehmende)                                  |
| ------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| Wo           | Menüpunkt in ChurchTools                    | eigene Adresse der Gemeinde (z. B. `anmeldung.eure-gemeinde.de`) |
| Anmelden     | Wer in ChurchTools angemeldet ist, ist drin | ohne Konto; ändern und absagen über den Link in der Bestätigung  |
| Installieren | ZIP hochladen (unten)                       | Formular-Paket auf den eigenen Webspace legen (unten)            |

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

### Das Formular für Gäste (Voraussetzung)

Gäste ohne Konto können Seiten von Erweiterungen nicht öffnen (gemessen: ChurchTools zeigt ihnen die
Login-Seite, auch für die Dateien der Erweiterung, und es gibt kein Recht für nicht angemeldete Besucher).
Das Formular ist deshalb eine kleine Seite **auf eurem eigenen Webspace** – ohne Server-Logik, sie spricht
direkt mit eurem ChurchTools. **Ohne sie ist die Erweiterung nicht nutzbar** (Alwin, 14.10.2026); die
Startseite zeigt bis dahin nur „Erst einrichten“.

1. Beim Anbieter eurer Website eine Subdomain anlegen, z. B. `anmeldung.eure-gemeinde.de` (mit HTTPS).
2. Am Release die Datei **`anmeldungen-formular-v….zip`** herunterladen, **entpacken** und den Inhalt
   (`index.html`, Ordner `assets`) in den Ordner der Subdomain hochladen. Aktualisieren: Inhalt ersetzen.
3. In ChurchTools die Adresse als **erlaubte Herkunft** eintragen (Einstellung
   `access_control_allow_origins`, z. B. `https://anmeldung.eure-gemeinde.de`) – sonst blockt der Browser
   jede Anfrage des Formulars. Das gibt keine Daten frei, es erlaubt nur dieser Seite, die Schnittstellen zu
   nutzen, die ChurchTools für Gäste ohnehin hat.
4. In der Erweiterung **„Einstellungen“** (nur Gruppen-Admins): die Adresse eintragen. Die Erweiterung prüft,
   ob die Seite antwortet und ob sie als erlaubte Herkunft eingetragen ist.

Jeder Link zu einer Anmeldung lautet dann `https://anmeldung.eure-gemeinde.de/#eure-instanz.church.tools/<Nummer>`
– hinter `#` stehen Instanz und Gruppe. Damit Veranstalter die Adresse bekommen, brauchen sie das Recht, die
Kategorie „Einstellungen der Anmeldungen“ zu **sehen**.

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

**Freigeben macht die Anmeldung für Gäste lesbar:** Die Erweiterung stellt die Gruppe dabei auf „öffentlich“
(`visibility`). Nur so kann das Formular sie ohne Login lesen. In einer öffentlichen Liste taucht sie dadurch
nicht auf – gefunden wird sie nur über ihren Link.

**Freigeben richtet das Anmelden ein** (A6-2): ChurchTools nimmt eine Anmeldung erst an, wenn die Gruppe eine
**Leitung** hat und feststeht, welchen **Status, Standort und Bereich** neue Personen bekommen. Beim Freigeben
wählt man die Leitung (Leute aus dem Team; wer freigibt, ist vorgewählt) – sie bekommt in dieser Gruppe die Rolle
„Leiter“, sieht die Anmeldungen auch direkt in ChurchTools und ist dort Ansprechpartner. Danach fragt die
Erweiterung ChurchTools wie ein Gast, ob Anmeldungen angenommen werden, und sagt sonst, was fehlt.

**Einstellungen der Gemeinde** (Startseite → „Einstellungen“, nur Gruppen-Admins): Status, Standort und Bereich
für neue Personen – einmal für alle Veranstaltungen. Ohne gespeicherte Einstellung gilt der Vorschlag
„Interessent“ und – wenn es nur einen gibt – der einzige Standort und Bereich. Gespeichert im Datenbereich der
Erweiterung (Kategorie „Einstellungen der Anmeldungen“, beim ersten Speichern angelegt). Damit Veranstalter die
gespeicherte Wahl beim Freigeben bekommen, brauchen sie in ChurchTools das Recht, diese Kategorie zu **sehen**;
ohne das gilt für sie der Vorschlag.

**Wer bei einer Anmeldung Mitglied wird** (Alwin, 14.10.2026, „Variante A“): genau die Personen unter „Wer
nimmt teil?“. Name der Kontaktperson („Angemeldet von“), Telefon, Bemerkungen, Betrag, Aufschlüsselung, Auswahl
und Extras stehen als Felder bei der **ersten** Person; alle bekommen die E-Mail-Adresse der Kontaktperson. Bei
„Nur Kinder“ belegen Eltern so keinen Platz. Ist jemand schon bekannt (Name und Adresse), schickt ChurchTools
eine Mail zum Bestätigen – erst danach gilt die Anmeldung.

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
    Am gewählten Feld stehen unten Pfeile, Kopieren und Entfernen; am Computer lässt sich jedes Feld auch
    ziehen. **Am Handy wird nicht gezogen** – Feld antippen und mit den Pfeilen verschieben; ein neuer Baustein
    landet unter dem gewählten Feld.
  - **Kopf:** Name und Begrüßungstext direkt anklicken; „Titelbild ändern“ (und entfernen) steht im Bild. Das
    Titelbild ist das Gruppenbild in ChurchTools und öffentlich sichtbar.
  - **Design:** Startpunkt, Farben, Schrift, Logo, Feldstil, Knöpfe … – man sieht es sofort im Formular. Oben
    „Computer/Handy“ und „Vorschau“ (zum Ausprobieren, ohne Bearbeiten).
  - **Woher kommt was?** Ein kleines ⓘ steht dort, wo etwas Pflicht ist oder aus einer Einstellung kommt
    (Name, E-Mail, Name jeder Person, Geburtsdatum, Datenschutz, „Wer nimmt teil?“, „Auswahl und Extras“);
    antippen zeigt den Grund. **„Wer meldet sich an?“** und „Geburtsdatum abfragen“ lassen sich oben in der
    Leiste „Bausteine“ umstellen – dieselbe Einstellung wie im Reiter Veranstaltung.
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
- Formular: `npm run dev -w formular` (Port 5177; die Test-Instanz erlaubt `http://localhost:5177`). Am Release
  hängt es als `anmeldungen-formular-v….zip` – jede Gemeinde legt es auf ihren eigenen Webspace.
