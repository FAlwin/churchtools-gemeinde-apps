# Die Musik App als ChurchTools-Erweiterung

Die Musik App gibt es in zwei Formen:

|                                      | **Erweiterung** (diese Anleitung)                  | **Eigener Server** ([INSTALL.md](../../INSTALL.md)) |
| ------------------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| Was ihr braucht                      | Admin-Zugang zu eurem ChurchTools – sonst nichts   | Einen Server mit Docker (z. B. eine NAS)            |
| Anmelden                             | Wer in ChurchTools angemeldet ist, ist drin        | Eigene Anmeldung mit den ChurchTools-Zugangsdaten   |
| Wo sie liegt                         | Menüpunkt in ChurchTools (im Browser)              | Eigene Adresse, auf dem Homescreen installierbar    |
| Termine, Ablauf, Liedblatt           | ✓                                                  | ✓                                                   |
| Anmerkungen, Zoom, Tonart merken     | ✓ (als Dateien an der eigenen Person, siehe unten) | ✓                                                   |
| Vollbild                             | ✓ (Knopf legt die App über die ChurchTools-Leiste) | ✓ (Homescreen-App)                                  |
| Offline im Saal                      | –                                                  | ✓                                                   |
| Lied-Statistik (Häufigkeit, zuletzt) | ✓ (ab v2.32.0, aus der Statistik von ChurchTools)  | ✓                                                   |
| Suche im Liedtext                    | –                                                  | ✓                                                   |
| Abwesenheiten eintragen              | – (noch offen, evtl. im Dienstplaner)              | ✓                                                   |
| Ablauf bearbeiten, Tempo             | ✓ (ab v2.29.0)                                     | ✓                                                   |
| Lieder verwalten, Notenblätter       | ✓ (ab v2.29.0; SongSelect ab v2.31.0)              | ✓                                                   |
| Links, Standard-Ansicht (Admin)      | ✓ (ab v2.29.0, gespeichert in ChurchTools)         | ✓                                                   |
| Team-Notizen („Notizen von …")       | ✓ (ab v2.29.0, Rechte siehe unten)                 | ✓                                                   |
| In der ChurchTools-App am Handy      | – (ChurchTools zeigt Erweiterungen nur im Web)     | eigene App auf dem Homescreen                       |

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-musik-app/releases) die neueste Datei
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
Sitzung. Welche Rechte wofür nötig sind, steht hier **an einer Stelle**. Vergeben werden sie unter
**Berechtigungen** (am einfachsten über den Status oder die Gruppe eures Musikteams). ChurchTools zeigt
hinter jedem Recht seinen Schlüssel in Klammern – danach könnt ihr suchen.

| Wofür                                                             | Wer braucht es                                                         | Recht in ChurchTools                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Den Menüpunkt „Musik App" sehen                                   | alle, die die App nutzen                                               | Erweiterung: **„Musik App" sehen** (`view`)                                                                                                                                                                    |
| Lieder sehen                                                      | alle, die die App nutzen                                               | Events: Lieder sehen (`view songcategory`) – für die Kategorien, die sie sehen sollen                                                                                                                          |
| Termine und Abläufe sehen                                         | alle, die die App nutzen                                               | Events: Abläufe sehen (`view agenda`)                                                                                                                                                                          |
| Anmerkungen, Tonart, Zoom speichern                               | alle, die die App nutzen                                               | Personen: **Eigene Personendaten bearbeiten** (bei uns über den Status „Mitglied")                                                                                                                             |
| Gemeinde-Einstellungen bekommen (Links, „PDF zuerst")             | alle, die die App nutzen                                               | Erweiterung: **Kategorien sehen** (`view custom category`) und **Daten in Kategorie sehen** (`view custom data`) für „Einstellungen der Musik App"                                                             |
| Team-Notizen nutzen („Notizen von …", „Meine Anmerkungen teilen") | Musiker der in der Verwaltung gewählten Gruppen und Rollen             | Erweiterung, für „Team-Notizen der Musik App": `view custom category`, `view custom data`, **Daten in Kategorie erstellen** (`create custom data`), **Daten in Kategorie löschen** (`delete custom data`)      |
| Lied-Statistik („Häufigkeit", „Zuletzt" bei den Liedern)          | wer die Statistik sehen soll (bei uns: nur die Musiker)                | Events: **Song-Statistik sehen** (`view song statistics`) – ohne gibt es die Reiter nicht. Am besten dort vergeben, wo die Musiker ihre Lied-Rechte bekommen (z. B. ihre Gruppe), nicht beim Status „Mitglied" |
| Ablauf bearbeiten                                                 | wer Abläufe pflegt                                                     | Events: Abläufe bearbeiten (`edit agenda`)                                                                                                                                                                     |
| Lieder, Arrangements, Notenblätter, Tempo ändern                  | wer Lieder pflegt                                                      | Events: Lieder bearbeiten (`edit songcategory`) – je Kategorie                                                                                                                                                 |
| CCLI SongSelect (suchen, Lied anlegen, Notenblatt holen)          | wer Lieder pflegt – nur mit SongSelect-Abo der Gemeinde in ChurchTools | Events: SongSelect nutzen (`use ccli`) – was aufs Kontingent zählt: [songselect-kontingent.md](songselect-kontingent.md)                                                                                       |
| Verwaltung in der App (unter **Mehr**)                            | Admins                                                                 | `administer persons` (Personen administrieren) – Admins haben es meist schon                                                                                                                                   |
| Gemeinde-Einstellungen und Team-Gruppen speichern                 | Admins                                                                 | Erweiterung: **Kategorien erstellen** (`create custom category`), dazu für „Einstellungen der Musik App" `create custom data` und **Daten in Kategorie bearbeiten** (`edit custom data`)                       |

**Beispiel ECG – Liederbuch für alle Mitglieder** (Status „Mitglied", ohne Abläufe): Veranstaltungen:
„Veranstaltungen" sehen (`view`) und Einzelne Song-Kategorien sehen (`view songcategory`) für die
Kategorien, die alle sehen sollen; Erweiterung: „Musik App" sehen (`view`), dazu Kategorien sehen und
Daten in Kategorie sehen **nur** für „Einstellungen der Musik App". Ohne `view agenda` öffnet die App
direkt bei „Lieder", einen Reiter „Termine" gibt es dann nicht. Die Musiker bekommen über die Rollen
ihrer Gruppe zusätzlich Abläufe, „Song-Statistik sehen", die Team-Notizen und das Bearbeiten.

**Mehr braucht ein Musiker nicht – und sollte er nicht haben:** kein „-- Alle --" (gilt sonst auch für
jede künftige Kategorie), kein Kategorien bearbeiten/löschen und bei „Einstellungen der Musik App" weder
Daten erstellen noch bearbeiten noch löschen. Sonst könnte jeder Musiker die Gemeinde-Einstellungen
überschreiben oder eine Kategorie der App löschen. ChurchTools schützt die Daten einer Kategorie nicht
je Eintrag – wer dort schreiben darf, darf alles darin.

Die beiden Kategorien „Einstellungen der Musik App" und „Team-Notizen der Musik App" legt die App selbst
an, wenn ein Admin zum ersten Mal speichert (Team-Notizen: sobald eine Gruppe gewählt ist). **Erst danach
lassen sie sich bei den Rechten auswählen** – also: als Admin einmal speichern, dann die Rechte vergeben.
Die Kategorien nicht löschen; sie gehören der App.

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
  Ändern oder löschen kann sie nur die Person selbst.
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
