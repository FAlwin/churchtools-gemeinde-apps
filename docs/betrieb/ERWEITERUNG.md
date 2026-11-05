# Die Musik App als ChurchTools-Erweiterung

Die Musik App gibt es in zwei Formen:

|                                      | **Erweiterung** (diese Anleitung)                  | **Eigener Server** ([INSTALL.md](../../INSTALL.md)) |
| ------------------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| Was ihr braucht                      | Admin-Zugang zu eurem ChurchTools – sonst nichts   | Einen Server mit Docker (z. B. eine NAS)            |
| Anmelden                             | Wer in ChurchTools angemeldet ist, ist drin        | Eigene Anmeldung mit den ChurchTools-Zugangsdaten   |
| Wo sie liegt                         | Menüpunkt in ChurchTools (im Browser)              | Eigene Adresse, auf dem Homescreen installierbar    |
| Termine, Ablauf, Liedblatt           | ✓                                                  | ✓                                                   |
| Anmerkungen, Zoom, Tonart merken     | ✓ (als Dateien an der eigenen Person, siehe unten) | ✓ – dieselben wie in der Erweiterung                |
| Vollbild                             | ✓ (Knopf legt die App über die ChurchTools-Leiste) | ✓ (Homescreen-App)                                  |
| Offline im Saal                      | –                                                  | ✓                                                   |
| Lied-Statistik (Häufigkeit, zuletzt) | ✓ (ab v2.32.0, aus der Statistik von ChurchTools)  | ✓                                                   |
| Suche im Liedtext                    | –                                                  | ✓                                                   |
| Abwesenheiten eintragen              | ✓ (ab Dienstplaner E7-2b, direkt in ChurchTools)   | ✓                                                   |
| Ablauf bearbeiten, Tempo             | ✓ (ab v2.29.0)                                     | ✓                                                   |
| Lieder verwalten, Notenblätter       | ✓ (ab v2.29.0; SongSelect ab v2.31.0)              | ✓                                                   |
| Links, Standard-Ansicht (Admin)      | ✓ (ab v2.29.0, gespeichert in ChurchTools)         | ✓                                                   |
| Team-Notizen („Notizen von …")       | ✓ (ab v2.29.0, Rechte siehe unten)                 | ✓                                                   |
| In der ChurchTools-App am Handy      | – (ChurchTools zeigt Erweiterungen nur im Web)     | eigene App auf dem Homescreen                       |

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`musik-app-v….zip`** herunterladen (nicht entpacken).
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Musik App" – so heißt der Menüpunkt.
   - **Kürzel:** genau **`musik-app`**. Die App ist für diese Adresse gebaut (`/ccm/musik-app/`); mit
     einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

## Rechte einrichten

Die App kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren
Sitzung. Vergeben werden die Rechte unter **Administration → Berechtigungen**, am einfachsten über einen
Status oder die Rollen einer Gruppe. ChurchTools zeigt hinter jedem Recht seinen Schlüssel in Klammern –
danach könnt ihr suchen. **Diese Übersicht ist die eine Stelle für alle Rechte der Musik App**; braucht
eine neue Funktion ein Recht, kommt es hier dazu (eine Prüfung in der CI achtet darauf).

**Reihenfolge:**

1. Erweiterung hochladen, Kürzel genau `musik-app` (siehe oben).
2. Als Admin in der App unter **Mehr → Verwaltung** eine Einstellung ändern (z. B. „Liedblatt:
   Standard-Ansicht") und bei **„Anmerkungen"** die Musikteam-Gruppe wählen. Dabei legt die App ihre zwei
   Kategorien an: „Einstellungen der Musik App" und „Team-Notizen der Musik App".
3. Erst jetzt die Rechte vergeben – vorher stehen die beiden Kategorien nicht zur Auswahl.

### Rechte der Erweiterung „Musik App"

Diese Rechte braucht die App, damit sie funktioniert. **Nutzer** = alle, die die App öffnen sollen ·
**Musiker** = wer Team-Notizen teilt · **Admin** = wer die App verwaltet.

| Recht                                               | Einstellungen: Nutzer | Musiker | Admin | Team-Notizen: Nutzer | Musiker | Admin |
| --------------------------------------------------- | :-------------------: | :-----: | :---: | :------------------: | :-----: | :---: |
| „Musik App" sehen (`view`)                          |           ✓           |    ✓    |   ✓   |          ✓           |    ✓    |   ✓   |
| Kategorien sehen (`view custom category`)           |           ✓           |    ✓    |   ✓   |          –           |    ✓    |   ✓   |
| Kategorien erstellen (`create custom category`)     |           –           |    –    |   ✓   |          –           |    –    |   ✓   |
| Kategorien bearbeiten (`edit custom category`)      |           –           |    –    |   –   |          –           |    –    |   –   |
| Kategorien löschen (`delete custom category`)       |           –           |    –    |   –   |          –           |    –    |   –   |
| Daten in Kategorie sehen (`view custom data`)       |           ✓           |    ✓    |   ✓   |          –           |    ✓    |   ✓   |
| Daten in Kategorie erstellen (`create custom data`) |           –           |    –    |   ✓   |          –           |    ✓    |   ✓   |
| Daten in Kategorie bearbeiten (`edit custom data`)  |           –           |    –    |   ✓   |          –           |    –    |   –   |
| Daten in Kategorie löschen (`delete custom data`)   |           –           |    –    |   –   |          –           |    ✓    |   ✓   |

„Musik App" sehen und Kategorien erstellen gibt es in ChurchTools nur einmal, nicht je Kategorie – sie
gelten für beide Spalten gleich.

> **Den Unterpunkt „-- Alle --" nirgends anhaken** – er gilt sonst auch für jede künftige Kategorie. Und
> nicht mehr vergeben als oben: ChurchTools schützt die Daten einer Kategorie nicht je Eintrag. Wer
> „Einstellungen der Musik App" bearbeiten darf, kann die Einstellungen der ganzen Gemeinde überschreiben;
> wer Kategorien löschen darf, kann die App lahmlegen. Die beiden Kategorien gehören der App – nicht löschen.

### Weitere Rechte – Vorschlag

Wer was sehen und bearbeiten darf, entscheidet jede Gemeinde selbst. Die App zeigt nur, was ChurchTools
der Person erlaubt.

| Funktion in der App                                | Recht in ChurchTools                                                                                                                                          | Vorschlag                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Lieder sehen                                       | Veranstaltungen: „Veranstaltungen" sehen (`view`) und Einzelne Song-Kategorien sehen (`view songcategory`), je Kategorie                                      | Musiker; wer will, auch alle als Liederbuch |
| Anmerkungen, Tonart, Zoom speichern                | Personen: Eigene Personendaten bearbeiten                                                                                                                     | alle Nutzer                                 |
| Abwesenheiten                                      | kein eigenes Recht – die eigenen pflegt jede Person selbst (fremde → 403, gemessen)                                                                           | –                                           |
| Termine und Abläufe                                | Events: Abläufe sehen (`view agenda`)                                                                                                                         | Musiker                                     |
| Info-Spalten im Ablauf (z. B. Technik)             | Events: Dienstgruppe sehen (`view servicegroup`) bzw. bearbeiten (`edit servicegroup`), je Dienstgruppe                                                       | Musiker, für die passenden Dienstgruppen    |
| Lied-Statistik („Häufigkeit", „Zuletzt")           | Events: Song-Statistik sehen (`view song statistics`) – ohne gibt es die Reiter nicht                                                                         | Musiker                                     |
| Ablauf bearbeiten                                  | Events: Abläufe bearbeiten (`edit agenda`), je Kalender – Admins eines Termins dürfen dessen Ablauf auch ohne (#635)                                          | wer Abläufe plant                           |
| Lieder, Arrangements, Notenblätter, Dateien, Tempo | Events: Lieder bearbeiten (`edit songcategory`), je Kategorie                                                                                                 | wer Lieder pflegt                           |
| CCLI SongSelect                                    | Events: SongSelect nutzen (`use ccli`) – nur mit SongSelect-Abo der Gemeinde; was aufs Kontingent zählt: [songselect-kontingent.md](songselect-kontingent.md) | wer Lieder pflegt                           |
| Verwaltung in der App (unter **Mehr**)             | Personen: Personen administrieren (`administer persons`)                                                                                                      | Admins                                      |

Info-Spalten: Man sieht nur die Spalten der Dienstgruppen, die man sehen darf. Wer nicht alle sieht,
bekommt beim Bearbeiten eines Ablaufs einen Hinweis – ChurchTools löscht beim Speichern die Infos der
Gruppen, die man nicht sieht.

**Beispiel ECG:** Alle Mitglieder (Status „Mitglied") bekommen die App als Liederbuch – Lieder sehen für
die Kategorien, die alle sehen sollen, aber **keine Abläufe**. Ohne `view agenda` öffnet die App direkt
bei „Lieder", einen Reiter „Termine" gibt es dann nicht. Die Musiker bekommen über die Rollen ihrer
Gruppe zusätzlich Abläufe, Info-Spalten, „Song-Statistik sehen", die Team-Notizen und das Bearbeiten.

**Was passiert, wenn ein Recht fehlt:**

- **Lieder und Abläufe:** Ohne beide sagt die App nach ein paar Sekunden „Dir fehlen in ChurchTools die
  Rechte für Lieder und Abläufe" (#444).
- **Gemeinde-Einstellungen:** keine Fehlermeldung – es gilt einfach die Vorgabe („Akkorde", keine Links).
- **Team-Notizen:** Ohne Mitgliedschaft in einer gewählten Gruppe (mit freigegebener Rolle) erscheinen
  sie gar nicht. Fehlen nur die Rechte an „Team-Notizen der Musik App", lässt sich „Meine Anmerkungen
  teilen" nicht einschalten (die App meldet, dass es nicht geklappt hat).
- **Anmerkungen speichern:** Die App sagt es; die Anmerkungen bleiben dann nur auf dem Gerät.

**Wie Team-Notizen funktionieren:** Wer unter **Mehr** „Meine Anmerkungen teilen" einschaltet, trägt
sich in „Team-Notizen der Musik App" ein (und beim Ausschalten wieder aus). Ob jemand wirklich teilt,
steht aber in seiner eigenen Datei `musikapp_daten.json` – die kann nur er selbst ändern; ein Eintrag,
den jemand von Hand macht, bewirkt also nichts.

## Gut zu wissen

- **Ganzer Bildschirm am iPad:** ChurchTools in Safari über **Teilen → „Zum Home-Bildschirm"** als
  App ablegen und darin den **Vollbild-Knopf** der Musik App nutzen (vier Ecken, oben rechts). Dann
  stehen weder Safari- noch ChurchTools-Leiste – wie bei der Musik App mit eigenem Server.
- **Wo die Anmerkungen liegen:** als Anhänge an der eigenen Person in ChurchTools (Menü **Personen** (nicht „Mein Profil“) → Person in der Liste anklicken → ganz unten **„Anhänge >>“**): je
  bemalter Liedseite ein Bild `musikapp_….png`, dazu eine Datei `musikapp_daten.json` (Tonart, Kapo,
  Zoom, Textnotizen, „gesehen"). **Mitglieder, die die Person sehen dürfen, können diese Anhänge
  öffnen** – die App kann ihre Sichtbarkeit nicht einschränken (über die Schnittstelle gemessen).
  Ändern oder löschen kann sie nur die Person selbst. **Die Musik App mit eigenem Server nutzt seit
  dem 09.10.2026 dieselben Dateien** – wer beide benutzt, sieht dieselben Anmerkungen. Was vorher nur
  in der Server-App lag, zieht beim ersten Öffnen dort von selbst um.
- **Kein Offline:** Im Saal ohne Netz gibt es in der Erweiterung keine Liedblätter. Wer das braucht,
  nimmt die Variante mit eigenem Server.
- **Last:** Jedes Gerät fragt ChurchTools selbst. Bremst ChurchTools (zu viele Anfragen), hält die App
  von sich aus eine Weile still, statt weiter anzufragen.

## Aktualisieren

Gibt es eine neue Version, steht in der Erweiterung unter **Mehr** ganz unten „Neue Version …
verfügbar“ – der Link führt zur Release-Seite mit der ZIP. Aktualisiert wird von Hand:

Neue ZIP herunterladen → **Administration → Erweiterungen** → beim Eintrag „Musik App" auf den
**Stift** → neue **ZIP-Datei** hineinziehen → **Speichern**. Name und Kürzel nicht ändern.

**Sonst ist nichts zu tun – vor allem nichts löschen.** Die Anhänge `musikapp_…` an den Personen sind
die gespeicherten Anmerkungen und Einstellungen der Musiker, die Kategorie „Einstellungen der Musik App"
die der Gemeinde; die neue Version liest beides einfach weiter.

## Entfernen

In **Administration → Erweiterungen** den Eintrag löschen. Die Anmerkungs-Dateien (`musikapp_…`) an
den Personen bleiben dabei liegen. Aufräumen ist freiwillig und **nur beim endgültigen Entfernen**
sinnvoll – dann sind die Anmerkungen damit weg. Wer das will, löscht sie an der Person: Menü **Personen** (nicht „Mein Profil“) → Person in der Liste anklicken → ganz unten **„Anhänge >>“**.

## Für Entwickler

Gebaut wird mit `npm run build:extension -w client` (Kürzel über `VITE_KEY`, Standard `musik-app`);
das Release hängt die ZIP automatisch an. Plan, Messungen und Entscheidungen:
[`docs/entwicklung/plan-extension.md`](../entwicklung/plan-extension.md).
