# Datenschutz – welche Daten die Apps nutzen und wohin sie fließen

> **Stand 18.11.2026, aus dem Code erhoben** (je Aussage eine Fundstelle; die übrige Doku war nur Hinweisgeber).
> Anlass: Der angekündigte Extension Store von ChurchTools verlangt je Erweiterung Angaben zu genutzten Daten,
> Fremddiensten und eigenem Backend – bei eigenem Backend auch einen AVV (Auftragsverarbeitungsvertrag). Diese Seite
> ist die Vorlage dafür. Sie ist **keine Rechtsberatung**. Ändert sich an einer App etwas, das hier steht (neuer
> Endpunkt, neuer Dienst, neuer Speicher), diese Seite im selben PR nachziehen.

## Überblick

| App                   | Eigener Server                   | Fremddienste (automatisch)                       | Personendaten außerhalb von ChurchTools                |
| --------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Musik-App (Extension) | nein                             | GitHub (Update-Abfrage aus dem Browser)          | Browser des Geräts (Notizen, Cache)                    |
| Musik-App (PWA)       | **ja** (NAS, `server/`)          | GitHub (Update-Abfrage vom Server)               | Server: Teilen-Namen, Altbestand; Gerät: Cookie, Cache |
| Anmeldungen           | nein                             | keine                                            | keine                                                  |
| Anmelde-Formular      | nein (statische Seite, Webspace) | keine                                            | Zugriffsprotokolle des Webspace der Gemeinde           |
| Dienstplaner          | nein                             | keine                                            | keine                                                  |
| Protokolle            | nein                             | keine (KI nur von Hand über die Zwischenablage)  | keine                                                  |
| Organigramm           | nein                             | keine                                            | keine                                                  |
| Gebetsabend           | nein                             | **VDO.Ninja** (iframe: Video/Audio, Zuhörername) | VDO.Ninja                                              |
| Website (im Aufbau)   | nein                             | keine (Vorschau lädt nichts nach)                | keine                                                  |

Für alle Erweiterungen gilt:

- **Zugriff auf ChurchTools** immer mit der Sitzung der angemeldeten Person (`credentials: 'include'`) über
  `ui/ct/verbindung.ts`. Die Basis ist die eigene Instanz (`ui/ct/basis.ts:13`). Dateien lädt `ctDatei` nur von der
  eigenen Instanz (`ui/ct/verbindung.ts:454-463`). Jede Erweiterung sieht also nur, was die Person in ChurchTools
  ohnehin sehen darf.
- **Keine Schriften, Skripte oder Bilder von fremden Servern.** Die `index.html` aller Apps lädt nichts Externes.
  Schriften sind lokal gebündelt (`ui/design/schrift.ts`), die PDF-Schrift steckt im Code (`ui/teilen/pdfSchrift.ts`).
  Das pdf.js-Hilfsskript ist lokal (`ui/teilen/pdfWorker.ts`). QR-Codes und PDFs entstehen im Browser
  (`ui/teilen/qr.ts`, jsPDF).
  - Im gebauten jsPDF-Paket steht eine cdnjs-Adresse (`pdfobject`). Sie gehört zu `output('pdfobjectnewwindow')`.
    Wir rufen nur `output('blob' | 'arraybuffer')` auf (`ui/teilen/sharePdf.ts`), die Adresse wird also nie geladen.
- **Keine Analyse- oder Fehlerdienste** (kein Analytics, Sentry, Beacon). Eigene Cookies setzt keine Erweiterung.
- **Erweiterungs-Speicher** (`/custommodules/…/customdatacategories/…/customdatavalues`) läuft über
  `shared/ct/modulDaten.ts:54-119`. Er liegt in der ChurchTools-Datenbank der Gemeinde.

## Musik-App

Zwei Auslieferungen (`client/src/services/modus.ts:10-11`): **Extension** (der Browser spricht direkt mit
ChurchTools) und **PWA mit Server** (der Browser spricht nur mit dem eigenen Server, der Server mit ChurchTools;
Aufteilung in `client/src/services/churchtoolsApi.ts:96-122`).

**Daten in ChurchTools**

- Lesen: eigene Person (`/whoami`), eigene Gruppen und Rollen, Termine, Dienste samt eingeteilter Personen (für das
  Termin-Blatt, `client/src/services/ctLesen.ts:287-306`), Kalender, Lieder, Arrangements und Dateien, Abläufe und
  Ablaufvorlagen, Lied-Statistik.
- Schreiben: Lieder, Arrangements, Notenblätter (`shared/ct/liedVerwaltung.ts`, `shared/ct/notenblaetter.ts`),
  Abläufe und Ablaufvorlagen (`shared/ct/schreibKern.ts`, `shared/ct/ablaufVorlagen.ts`), **eigene Abwesenheiten**
  mit Freitext-Kommentar (`ui/ct/abwesenheitPort.ts:11-48`).
- SongSelect/CCLI: nur **über ChurchTools** (alte Schnittstelle, `shared/ct/songselect.ts:120-194`). Die App spricht
  CCLI nie selbst an.
- **Persönliche Ablage als Dateien an der eigenen Person** (`/files/person/{id}`, `shared/ct/personenAblage.ts`):
  `musikapp_daten.json` (Einstellungen, Textnotizen, Zoom, „gesehen“) und `musikapp_<Schlüssel>.png` (Zeichnungen).
  ⚠️ **Andere Mitglieder, die die Person sehen dürfen, können diese Dateien lesen** – bewusst hingenommen
  (`shared/ct/personenAblage.ts:11`, `shared/ct/teilen.ts:18-19`). „Teilen“ steuert nur, wessen Notizen die App
  anbietet.
- Erweiterungs-Speicher:
  - `musikapp-einstellungen`: Gemeinde-Einstellungen, ohne Personenbezug außer Gruppen- und Rollen-IDs
    (`client/src/services/ctEinstellungen.ts:33-34`).
  - `musikapp-teilen`: wer teilt, mit Personen-ID und Name (`shared/ct/teilen.ts:43-60`).

**Server (nur PWA, `server/`)**

- Keine Datenbank. Er speichert nur Dateien im Volume `/app/data` (`Dockerfile`, `services/jsonStore.ts`):
  - `site.json`: Gemeinde-Einstellungen.
  - `capabilities-cache.json`: Rechte je Konto-ID, 12 Stunden gültig.
  - `annotations/abmeldungen.json`: abgemeldete Sitzungen (Konto-ID und Zeitpunkt, bis 90 Tage).
  - `annotations/sharing.json`: Konto-ID → **Anzeigename** und „teilt“ (`services/sharing.ts:55-59`).
  - Altbestand aus der Zeit vor v2.33.0 (Notizen und Einstellungen je Konto). Er wird nur noch für den Umzug nach
    ChurchTools gelesen und 90 Tage danach gelöscht (`services/ablageUmzug.ts`).
- **Anmeldung:** Der Server reicht E-Mail und Passwort an ChurchTools weiter, das Passwort speichert er nicht
  (`services/ctAuth.ts`). Das Cookie `ct_session` (httpOnly, signiert, AES-256-GCM verschlüsselt, 30 Tage rollierend,
  höchstens 90 Tage; `middleware/session.ts`) enthält die ChurchTools-Sitzung und den **ChurchTools-Anmeldeschlüssel**
  (`/persons/{id}/logintoken`, `services/ctAuth.ts:164`). Beides liegt nur verschlüsselt auf dem Gerät, nicht auf dem
  Server.
- **Logs:** keine Namen oder E-Mails. Bei Fehlern stehen aber ChurchTools-Pfade mit Personen-IDs und Konto-IDs darin
  (`services/ctHttp.ts`, `services/ablageUmzug.ts`).
- Sicherheit: helmet mit strenger CSP (`connect-src 'self'`, `server/src/index.ts:58-93`), höchstens 50 Anmeldeversuche
  in 15 Minuten (`routes/auth.ts:13-20`).

**Fremddienste**

- **GitHub-API** `api.github.com/repos/FAlwin/churchtools-gemeinde-apps/releases/latest` (`shared/update/index.ts`),
  höchstens alle 6 Stunden. In der Extension fragt **der Browser selbst** (`client/src/services/updateApi.ts`): IP-Adresse
  und Browser-Kopfzeilen gehen an GitHub. In der PWA fragt der Server.
- Nur auf Antippen: PayPal-Spendenlink (`client/src/components/SupportBox.tsx`), GitHub-Seite, Gemeinde-Links aus den
  Einstellungen.

**Im Browser**

- localStorage `worship_…`: Zeichnungen (PNG), Textnotizen, Lied-Einstellungen, Spiegel angesehener **fremder**
  Notizen (`client/src/services/teamNotes.ts:18`). Wird beim Abmelden und beim Personenwechsel geräumt
  (`client/src/utils/clearDeviceData.ts`).
- localStorage `worship:letzte-person` = ChurchTools-Personen-ID; bleibt auch nach dem Abmelden
  (`client/src/utils/devicePrefs.ts:42`).
- IndexedDB `worship-rq-cache`: Abfrage-Zwischenspeicher bis 7 Tage, mit Abläufen samt Personennamen
  (`client/src/queryClient.ts`). Wird beim Abmelden gelöscht.
- Nur PWA: Service-Worker-Cache `worship-files` für Liedblätter (60 Einträge, 30 Tage).

**Export:** PDF im Browser (Liedblatt, Termin-Blatt mit Dienst-Namen). Eigene Notizen nur auf Wunsch, Vorgabe aus.

## Anmeldungen (Erweiterung)

**Daten in ChurchTools**

- Personen lesen: Name, E-Mail, Geburtstag, Adresse (`ui/ct/personen.ts`). Personen suchen.
- Personen schreiben: **„Von Hand“ anlegen** mit Name, optional Geburtstag und E-Mail, Status, Standort, Bereich und
  **Datenschutz-Zustimmung** samt Datum und „wer stimmt zu“ (`anmeldungen/src/vonHand.ts:97-117`). Geburtsdatum und
  Adresse nachtragen (`PATCH /persons/{id}`).
- Personen werden nie gelöscht.
- Je Veranstaltung eine **Gruppe** mit Mitgliedern und Gruppenfeldern (Antworten, Telefon, Erziehungsberechtigte,
  Unterschrift-Daten, Betrag, bezahlt). Die Einstellungen stehen gepackt in der **Gruppenbeschreibung**
  (`anmeldungen/src/einrichten.ts:181-230`). Diese ist öffentlich lesbar und enthält **Bankverbindung und
  Kontakt-Text der Veranstalter**, keine Teilnehmerdaten.
- Termine im Kalender (absichtlich nicht mit der Gruppe verknüpft). Routinen für Bestätigungs-, Wartelisten- und
  Erinnerungs-Mails sowie für das Löschen (`anmeldungen/src/ablaeufe.ts`).
- Rundmail über die alte ChurchTools-Schnittstelle `sendEMailToPersonIds` (seit W3b-3 im gemeinsamen Sende-Baustein `ui/ct/mailSenden.ts`; `anmeldungen/src/rundmail.ts` ruft ihn auf – dort stehen nur noch Platzhalter und Vorschau).
  Absagen auf der Warteliste über `mailto:` bzw. die Zwischenablage.
- Titelbild und Logo als Gruppenbild (`/files/groupimage/{id}`).
- Erweiterungs-Speicher `anmeldungen-einstellungen`: Vorgaben für neue Personen (IDs), Formular-Adresse, Zahlarten
  (`anmeldungen/src/gemeinde.ts:42-52`). Keine Personendaten.

**Löschen**

- Frist je Veranstaltung: Standard 3 Monate nach dem Ende, wählbar 1–36 Monate (`shared/anmeldung/termin.ts:145-155`).
  Eine ChurchTools-Routine wartet bis zu diesem Tag und entfernt dann die Mitgliedschaften (`remove-member`,
  `shared/anmeldung/ablaeufe.ts:736-745`).
- Gelöscht werden damit die Gruppenfelder. **Die Person bleibt in ChurchTools.** Ohne Termin wird nicht gelöscht.
- Archivieren geht erst nach dem Löschen. Endgültig löschen entfernt die Gruppe samt Verlauf.

**Fremddienste:** keine. Einzige Anfrage außerhalb von ChurchTools ist eine Erreichbarkeitsprüfung der
eingetragenen Formular-Adresse ohne Daten (`fetch(..., { mode: 'no-cors' })`, `anmeldungen/src/gemeinde.ts:193`).

**Im Browser:** nur IDs und Datumsangaben (`anmeldungen.verschoben.<gruppe>`, `anmeldungen.zeilen-oben.<gruppe>`).

**Export:** Druckliste und Aushang als PDF im Browser. Kein CSV.

## Anmelde-Formular (öffentliche Seite)

- **Ohne Login** (`credentials: 'omit'`, `formular/src/laden.ts:45,94`, `formular/src/senden.ts:94`). Es spricht nur
  Instanzen an, die in `instanzen.json` auf dem Webspace stehen (`formular/src/laden.ts:62-77`).
- Lesen: `/publicgroups/{id}` mit Einstellungen, Bild, Plätzen und Warteliste. Dazu `/info`, `/config` und
  `/publicgroups/{id}/form`.
- Schreiben: `/publicgroups/{id}/token` und `/signup`, je teilnehmender Person eine Anmeldung. Daraus entsteht in
  ChurchTools eine Person bzw. ChurchTools gleicht mit dem Bestand ab. Übermittelt werden Vorname, Nachname, E-Mail
  der Kontaktperson, Geburtsdatum und Adresse nur, wenn abgefragt, sowie die Antworten als Gruppenfelder
  (`shared/anmeldung/senden.ts`).
  - **Erziehungsberechtigte** (Name, Telefon, Häkchen) landen als Text im Gruppenfeld. Es wird keine eigene Person
    angelegt.
  - **Unterschrift** wird als Strich-Daten (Text, höchstens 4.000 Zeichen) gespeichert, nicht als Bild
    (`shared/anmeldung/unterschrift.ts`).
- **Einwilligung** als Pflichtfeld mit Löschdatum im Text (`ui/anmeldeformular/FeldEingabe.tsx:160-166`), an
  ChurchTools als `hasAcceptedPrivacyForSelf`.
- „Deine Anmeldung“ und Absagen mit dem Abmelde-Schlüssel aus der Mail (`/signoutdata`, `/signout`). Der Schlüssel
  steht im Link.
- Spam-Schutz ohne Fremddienst: Honigtopf-Feld und Mindest-Ausfüllzeit (`shared/anmeldung/spamschutz.ts`).
- **Im Browser:** nichts gespeichert, Eingaben nur im offenen Tab.
- **Hosting:** auf dem Webspace der Gemeinde. Deren Zugriffsprotokolle (IP-Adressen) liegen bei der Gemeinde bzw.
  ihrem Hoster. Als Vorlage für die Sicherheits-Kopfzeilen dient `formular/public/htaccess.beispiel` (CSP nur `self`
  und die ChurchTools-Instanzen).

## Dienstplaner

**Daten in ChurchTools**

- Lesen: Termine mit Diensten, Dienstgruppen, eigene Anfragen, „Wer kann?“ (`possiblepersons`), Gruppenmitglieder mit
  Profilbild-Adresse, **Abwesenheiten der Gruppe** (nur mit ChurchTools-Recht, `dienstplaner/src/ladePersonen.ts:115`),
  Lieder, Abläufe und Termin-Dateien.
- Schreiben:
  - Einteilen, Zu- und Absagen, Dienst-Tausch, Anzahl je Dienst, Termininfos.
  - Eigene Abwesenheiten.
  - Abläufe und Lieder (wie die Musik-App), Termin-Anhänge und Links.
  - Vorlieben je Person und Dienstgruppe (alte Schnittstelle, `shared/dienstplan/vorlieben.ts:111-132`).
- Erweiterungs-Speicher:
  - `dienstplaner-entwuerfe-<Gruppe>`: noch nicht gesendete Einteilungen mit Personen-ID und Name bzw. Gastname
    sowie dem Namen der planenden Person (`shared/dienstplan/entwuerfe.ts:57-69,114`).
  - `dienstplaner-antworten-<Gruppe>`: „Wann kann ich?“ – Ja/Vielleicht je Person und Termin
    (`shared/dienstplan/verfuegbarkeit.ts:62-100`). Ein „Nein“ wird eine ChurchTools-Abwesenheit.
- Mails verschickt die Erweiterung selbst nicht. Benachrichtigungen bei Anfragen kommen von ChurchTools.

**Fremddienste:** keine. Links von Nutzern öffnen sich nur auf Klick (nur `http(s)`, `shared/ct/sichereAdresse.ts`).

**Im Browser:** nur Ansichts- und Filtereinstellungen mit IDs, keine Namen.

**Export:** Plan, „Meine Dienste“, Termin-Blatt und Liedblatt als PDF im Browser.

## Protokolle

**Daten in ChurchTools**

- Lesen: **alle sichtbaren Personen** (nur ID, Vor- und Nachname), damit die KI-Funktion Namen ersetzen kann
  (`protokolle/src/kiPersonen.ts`). Dazu Gruppenmitglieder mit Profilbild, Gruppen und Rollen, Kalender und Termine,
  Gruppentreffen.
- Schreiben:
  - Termine mit Einladungen (ChurchTools verschickt dazu selbst Mails, `protokolle/src/bearbeiten.ts:6-10`).
  - Termine **ohne Einladung** aus dem Reiter „Termine“ (Titel, Datum, Uhrzeit, optional Ort; `protokolle/src/terminAnlegen.ts`, `terminEintragen.ts`); gelesen werden dafür die Kalender (nur die mit dem Recht „Termine anlegen“) und die Termine des gewählten Tages.
  - Gruppentreffen, Anwesenheit und Check-in.
  - Optional ein **Beitrag in der Gruppe** (`group_intern`, `protokolle/src/beitragSchreiben.ts`).
  - Rechte je Gruppenrolle beim Einrichten (`protokolle/src/einrichten.ts:181-204`).
  - Persönliche Einstellungen als Datei `protokolle_einstellungen.json` an der eigenen Person. Für andere Mitglieder
    gilt dieselbe Lesbarkeit wie bei der Musik-App.
- Erweiterungs-Speicher (`shared/protokolle/speicher.ts`):
  - `protokolle-g<Gruppe>`: Protokolle mit Freitext (kann Namen enthalten), Status, Freigabe und Sperre mit
    Personen-ID und Name.
  - `mitarbeit-g<Gruppe>`: To-Dos mit Zuständigen (IDs, bei Externen nur Name), Vorschläge sowie je Termin-Baustein ein Vermerk „im Kalender / nicht eintragen“ (Person-ID, Zeit, Kalender- und Termin-Nummer; `shared/protokolle/terminStand.ts`).
  - `vorlagen`: Protokoll-Vorlagen.

**KI („Mit KI füllen“):** Die Erweiterung ruft **keine** KI auf (`protokolle/src/KiFuellenFenster.tsx:141-155`).

1. Das Transkript (eingefügt oder `.txt`/`.docx`, im Browser gelesen) bleibt im Fenster.
2. Namen werden durch Platzhalter ersetzt.
3. Den Auftrag kopiert die Person selbst zu einer KI ihrer Wahl und fügt die Antwort wieder ein.

Es wird nichts gespeichert, weder im Browser noch in ChurchTools.

**Fremddienste:** keine.

**Im Browser:** To-Do-Ansicht und Filter (`protokolle.todos.einstellungen.<Personen-ID>`). Die Filtertexte können
Namen enthalten.

**Export:** Protokoll als PDF im Browser.

## Organigramm

**Daten in ChurchTools**

- Lesen: alle Gruppen samt Hierarchie und Typen, Mitglieder mit Name, Profilbild und Rolle, Einsätze aus Terminen,
  Dienste. Im Reiter „Kinder & Jugend“ zusätzlich die **Geburtsdaten der Kinder** für das Alter am Stichtag
  (`organigramm/src/ladeKinderJugend.ts:114-143`).
- Schreiben:
  - Gruppen anlegen, umhängen und ändern, Mitglieder pflegen.
  - Rechte am Gruppentyp „Gruppenwechsel“.
  - Routinen, die nach 90 Tagen aus der Wechsel-Gruppe austragen (`shared/organigramm/gruppenwechsel.ts:56,580-607`).
- Erweiterungs-Speicher `plan`, `sichtbar`, `gruppenwechsel`: Gruppen-IDs und Einstellungen, dazu Personen-ID und
  Name der letzten Bearbeitung. Keine Mitgliederdaten.

**Fremddienste:** keine.

**Im Browser:** nur Ansichtseinstellungen.

**Export:** Organigramm als PDF im Browser, auf Wunsch mit Personennamen.

## Gebetsabend

**Daten in ChurchTools**

- Lesen: eigene Person (Name für die Zuhörerliste), Rechte, Kalender und nächster Termin.
- Erweiterungs-Speicher:
  - „Gebetsabend: Zugang“: Stream-Kennung und Passwort, bei jedem Start neu und zufällig, dazu Personen-ID und Name
    der Technik (`shared/gebetsabend/zugang.ts:55-74`). **Lesen können alle Zuhörenden**, so ist es gewollt.
  - „Gebetsabend: Einstellungen“: Kalender und Suchwort.

**Fremddienst VDO.Ninja** (`shared/gebetsabend/links.ts`)

- Eingebettet als iframe von `https://vdo.ninja/`.
- **Sender** (Gerät im Raum): Kamera- und Mikrofonbild über VDO.Ninja, nach eigener Beschreibung als direkte
  Verbindung je Zuhörer. Name „Technik“.
- **Zuhörende**: senden weder Bild noch Ton (kein Mikrofon-Recht im iframe). Ihr **Vor- und Nachname aus ChurchTools
  steht im Link** (`label=…`). Die Technik sieht so, wer zuhört, gespeichert wird das nicht.
- An VDO.Ninja gehen damit IP-Adressen, Stream-Kennung und Passwort, die Namen der Zuhörenden und der Video- und
  Audiostrom.
- Welche Server VDO.Ninja für den Verbindungsaufbau nutzt (Signalisierung, STUN/TURN), steht nicht in unserem Code.
  Das muss vor einer Store-Angabe bei VDO.Ninja nachgelesen werden.

**Im Browser:** nichts gespeichert.

## Website (im Aufbau, W3a-2)

**Daten in ChurchTools**

- Lesen: eigene Person und deren Gruppen (Name, Mitgliedschaften, Rollen – nur um zu wissen, ob jemand die Gruppe „Website“
  leitet), globale Rechte (`administer groups`), die Liste der Gruppen (nur beim Einrichten durch einen Admin).
- Erweiterungs-Speicher (`shared/website/speicher.ts`): Kategorien „Website: Entwürfe · <Gruppe>“ und „Website: Veröffentlicht ·
  <Gruppe>“ – Seiten, Menü und Einstellungen der Website (Texte der Gemeinde, **keine Personendaten**; ob Personennamen auf einer
  Seite stehen, entscheidet die Gemeinde mit ihren Texten). Wer lesen darf, bestimmen die Rechte an den Kategorien.
- **Sperre je Seite (seit W3a-2):** Wer eine Seite gerade bearbeitet, steht als kleiner Wert in der Kategorie „Entwürfe“ – ChurchTools-
  Nummer, **Name** (Vor- und Nachname), Zeit des letzten Lebenszeichens und eine zufällige Fenster-Kennung (`shared/website/sperre.ts`).
  Der Name erscheint anderen Bearbeitern als „Gerade bearbeitet von …“. Beim Verlassen der Seite wird die Sperre auf „frei“ gesetzt
  (der Name bleibt dabei nicht stehen), gelöscht wird sie mit der Seite; ein verlassener Wert verfällt nach zehn Minuten.

**Fremddienste:** keine. Die Vorschau ist ein abgeschottetes `iframe` (`sandbox="allow-scripts"`, kein `allow-same-origin`,
`website/src/vorschauHtml.ts`); Stylesheet und Platzhalter-Bild stecken als `data:`-Adressen im Dokument, Schriften werden in der
Vorschau nicht geladen. Der Baustein „Eigenes HTML“ (nur Leitung) läuft dort ohne Zugriff auf ChurchTools.

**Im Browser:** nichts gespeichert.

**Später (nicht in W3a-1):** Der Bau-Dienst liest die Kategorie „Veröffentlicht“ mit einem eigenen ChurchTools-Benutzer und
legt fertige Seiten auf dem Webspace der Gemeinde ab; YouTube nur mit Einwilligung der Besucher. Diese Seite wird dann mit dem
Bau-Dienst ergänzt.
