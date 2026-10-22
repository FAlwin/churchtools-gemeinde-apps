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
   **Immer zusammen mit der Erweiterung aktualisieren:** Ein älteres Formular-Paket kennt neue Bausteine nicht
   (z. B. „Erziehungsberechtigte“, „Unterschrift“ seit A6-2b) und kann Formulare mit ihnen nicht anzeigen.
   **Per Skript (macOS):** Zugangsdaten einmal im Schlüsselbund ablegen –
   `security add-internet-password -s <FTP-Server> -a <FTP-Benutzer> -r "ftp " -w` (fragt nach dem Passwort) –,
   danach `ANMELDUNG_FTP_SERVER=<FTP-Server> ANMELDUNG_FORMULAR_ADRESSE=https://anmeldung.… npm run
formular:hochladen` (optional `ANMELDUNG_FTP_ORDNER`; `ANMELDUNG_FTP_BENUTZER`, sobald es für denselben Server mehrere
   Schlüsselbund-Einträge gibt). Am besten ein **eigener FTP-Zugang nur für den Ordner der Subdomain**, nicht der der Website. Das Skript baut das Formular, lädt per FTPS erst die neuen
   Dateien und zuletzt `index.html`, prüft die Seite im Netz und löscht erst dann alte Dateien. Das Passwort steht
   nirgends sonst. Als FTP-Server den Namen nehmen, auf den das Zertifikat des Anbieters lautet (bei Hetzner
   `wwwNNN.your-server.de`), sonst lehnt die verschlüsselte Verbindung ab.
   **ECG Donrath** (eingerichtet 16.10.2026, Webspace bei Hetzner, verwaltet von Willi Heidebrecht): Formular unter
   `https://anmeldung.ecg-donrath.de`, FTP-Server `www622.your-server.de`, eigener FTP-Benutzer `whebde_1` nur für den
   Ordner der Subdomain (Passwort im Schlüsselbund auf Alwins Mac). Hochladen:
   `ANMELDUNG_FTP_SERVER=www622.your-server.de ANMELDUNG_FTP_BENUTZER=whebde_1 ANMELDUNG_FORMULAR_ADRESSE=https://anmeldung.ecg-donrath.de npm run formular:hochladen`.
   Nie `whebde_0` nehmen – das ist der Zugang der Website (WordPress); das Skript bricht dort ohnehin ab.
3. In ChurchTools die Adresse als **erlaubte Herkunft** eintragen (Einstellung
   `access_control_allow_origins`, z. B. `https://anmeldung.eure-gemeinde.de`) – sonst blockt der Browser
   jede Anfrage des Formulars. Das gibt keine Daten frei, es erlaubt nur dieser Seite, die Schnittstellen zu
   nutzen, die ChurchTools für Gäste ohnehin hat.
4. In der Erweiterung **„Einstellungen“** (nur Gruppen-Admins): die Adresse eintragen. Die Erweiterung prüft,
   ob die Seite antwortet und ob sie als erlaubte Herkunft eingetragen ist.

**Spam-Schutz** (unsichtbar): ein verstecktes Feld, das nur Bots ausfüllen, und eine Mindest-Ausfüllzeit von 3
Sekunden. Gäste merken davon nichts. Ein Captcha gibt es bewusst nicht – ohne eigenen Server ließe es sich nicht
prüfen. Was trotzdem durchkommt, entfernt die Leitung in ChurchTools (sehen kann sie es im Reiter „Anmeldungen“).

**Nachprüfung:** Auf der Seite einer freigegebenen Veranstaltung rechnet die Erweiterung nach, was Gäste geschickt haben
(Beträge je Anmelde-Nr., Belegung je Auswahl, Plätze) und zeigt Hinweise – geändert wird nichts. Wichtig: Wartet
jemand, rückt in ChurchTools niemand von selbst nach, auch wenn ihr Plätze dazugebt; neue Anmeldungen kommen dann
hinten an. Nachrücken lassen geht im Reiter „Anmeldungen“ (siehe unten).

**Reiter „Anmeldungen“:** eine Zeile je Anmeldung (über die Anmelde-Nr.) mit Personen, Alter,
Warteplatz, Betrag und Zahlung; oben Plätze, Warteliste und offene Zahlungen, dazu der Hinweis, wenn Plätze frei sind
und jemand wartet. Filter: Alle, Zahlung offen, Warteliste, Abgesagt; Suche nach Namen. Ein Klick öffnet alle
Antworten – was für die ganze Anmeldung gilt (Kontakt, Erziehungsberechtigte, Unterschrift als Bild), steht einmal
oben. **Abgesagt** kommt aus dem Verlauf von ChurchTools: Er behält auch die Antworten der Abgesagten, deshalb gehen
Betrag oder Unterschrift nicht verloren, wenn die erste Person einer Anmeldung absagt. Sehen kann die Liste, wer in
ChurchTools die Mitglieder der Gruppe sehen darf. Gut zu wissen: Entfernt ihr in ChurchTools jemanden, bekommt die
Person **keine** Mail; beim Nachrücken schickt ChurchTools nur „Deine Anmeldung war erfolgreich“ – ohne Betrag.

**Nachrücken und Absagen:** Im Fenster einer Anmeldung hat jede wartende Person „Nachrücken lassen“, jede Person
„Absagen“ – beides mit Rückfrage. Ist alles voll, erhöht das Nachrücken die Plätze. Wer nachrückt, bekommt eine eigene
Zahlung (wie eine neue Anmeldung); beim Absagen wird die Zahlung der Anmeldung neu gerechnet und eine Rückzahlung
notiert – die Aufschlüsselung bekommt die Zeile „Abgesagt am …“, auch wenn der Betrag gleich bleibt (wer wartet). Danach gibt es „Mail schreiben“ mit fertigem Text – ChurchTools selbst schickt beim Nachrücken nur „war
erfolgreich“, beim Absagen gar nichts. Absagen lässt sich im Fenster rückgängig machen, Nachrücken nicht (sonst
schickt ChurchTools „Du stehst auf der Warteliste“).

**Anmeldung von Hand** (Telefon, Papier, auch nach dem Anmeldeschluss): Knopf „＋ Von Hand“ im Reiter „Anmeldungen“.
Erst die Person in ChurchTools suchen; gibt es sie nicht, legt ihr sie neu an (mit Geburtsdatum, E-Mail und wer dem
Datenschutz zugestimmt hat – die Person selbst oder ein Elternteil). Kennt ChurchTools den Namen schon, fragt die
Erweiterung nach, ob es dieselbe Person ist. Dann dieselben Fragen wie im Formular; die E-Mail-Adresse ist hier
freiwillig. Unterschreiben kann nur die Familie selbst – liegt die Unterschrift auf Papier vor, schaltet ihr „liegt
auf Papier vor“ ein, dann steht in ChurchTools „auf Papier – vermerkt von …“ mit eurem Namen und dem Tag. Platz wie im
Formular: Wartet jemand oder ist alles voll, kommt die Person hinten auf die Warteliste – oder ihr gebt ihr trotzdem
einen Platz (bei voller Gruppe werden dabei die Plätze erhöht). ChurchTools schickt keine Mail; danach gibt es „Mail
schreiben“ und „Rückgängig“ (nimmt die Person wieder aus der Anmeldung – eine neu angelegte Person bleibt in
ChurchTools). Neue Personen anlegen darf, wer in ChurchTools das Recht dazu hat; Status, Standort und Bereich kommen
aus den Vorgaben beim Freigeben.

**Person dazu:** Im Fenster einer Anmeldung (mit Anmelde-Nr.) holt „＋ Person dazu“ eine weitere Person in dieselbe
Anmeldung – etwa ein Geschwisterkind, das am Telefon nachgemeldet wird. Gefragt wird nur, was die Person betrifft;
Kontakt, Unterschrift und Auswahl gelten von der Anmeldung. Bekommt sie einen Platz, hat sie eine eigene Zahlung (wie
beim Nachrücken): den Betrag, um den die Anmeldung teurer wird. Die bisherige Zahlung bleibt, wie sie ist.

**Zahlung:** Im Fenster einer Anmeldung markiert ihr sie als **bezahlt** (Zahlart und Tag), setzt das zurück oder
**ändert den Betrag** (z. B. nach Absprache – in der Aufschlüsselung steht dann „Von Hand geändert am …“, und die
Nachprüfung meldet ihn nicht mehr). Bezahlt gilt für die ganze Anmeldung und steht in ChurchTools bei der ersten Person
(„Bezahlt“, „Bezahlt am“, „Zahlart“). Nach jeder Änderung gibt es „Rückgängig“. Die **Zahlarten** legt ihr in den
Einstellungen der Gemeinde fest (vorbelegt: Überweisung, Bar, PayPal); jede Veranstaltung kann einzelne abwählen
(Karte „Bezahlung“).

**Begrenzte Auswahl** (z. B. Zimmer): Je Option „Wie oft buchbar“ (jede Anmeldung belegt eins) und freiwillig
„Für wie viele Personen“ (nur ein Hinweis im Formular). Die Erweiterung zählt die Belegung, sobald jemand mit
Bearbeiten-Recht die Veranstaltung öffnet – erst dann sieht das Formular, was ausgebucht ist. Gäste können die
Anmeldungen selbst nicht lesen. Ausgebuchte Optionen sind im Formular nicht mehr wählbar.

**Mehrere Personen:** Das Formular meldet jede Person einzeln bei ChurchTools an (eine Anmeldung mit mehreren
Personen ohne Familienbeziehung lässt ChurchTools abstürzen – gemessen). Beim Hinzufügen einer Person prüft es die
freien Plätze: Mit Warteliste steht an der Person „Warteliste“, ohne Warteliste lässt sich niemand mehr hinzufügen,
wenn alles vergeben ist. Nach dem Absenden steht je Person, was daraus wurde. Wer zusammen angemeldet wurde,
erkennt ihr in ChurchTools an der gleichen **Anmelde-Nr.** Betrag, „Angemeldet von“ und Aufschlüsselung stehen bei
der ersten Person; der Betrag zählt nur, wer einen Platz bekommen hat – wer auf der Warteliste steht, zahlt erst beim
Nachrücken (die Aufschlüsselung nennt ihn).

**„Deine Anmeldung“:** Nach dem Anmelden schickt ChurchTools jeder angemeldeten Person seine Bestätigungsmail
(Text nicht änderbar). Der Link „Austreten“ darin führt auf eure Formular-Seite
(`…/#<instanz>/<Nummer>/abmelden/<Schlüssel>`) im Design der Veranstaltung: Dort sieht man, wer angemeldet ist, kann
einzelne Personen **absagen** (mit Rückfrage), sieht die **Bankdaten** (wenn etwas kostet) und an wen man für
Änderungen schreibt – den **Kontakt für Rückfragen** stellt ihr je Veranstaltung im Fenster „Anmeldung“ ein. Angaben
ändern geht dort nicht: Ohne Login gibt ChurchTools sie nicht heraus.

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
  - **Erziehungsberechtigte und Unterschrift** (empfohlene Bausteine, in der Vorlage „Kinder-Event“ schon drin,
    je einmal je Anmeldung): Bei „Erziehungsberechtigte“ tragen Gäste Name und Telefon ein (eine zweite Person
    freiwillig) und setzen das Häkchen „erziehungsberechtigt und einverstanden“. Die **Unterschrift** zeichnen sie
    mit Finger oder Maus; **am Handy** öffnet ein Tipp die Fläche im Vollbild (quer gehalten wird sie groß). In
    ChurchTools stehen sie bei der ersten angemeldeten Person: „Erziehungsberechtigte“ lesbar, „Unterschrift“
    lesbar als „✓ Erna Muster, 15.10.2026“ und die Striche in der Spalte „Unterschrift (Daten)“ (die man in der
    Liste ausblenden kann). Als Bild zu sehen ist die Unterschrift im Fenster einer Anmeldung (Reiter
    „Anmeldungen“), später auch auf der Druckliste. Ein ChurchTools-Feld fasst höchstens 4.000 Zeichen (gemessen) – eine Unterschrift braucht meist
    einige hundert.
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
