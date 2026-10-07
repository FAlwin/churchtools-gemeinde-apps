# Die Musik App als ChurchTools-Erweiterung

Die Musik App gibt es in zwei Formen:

|                                  | **Erweiterung** (diese Anleitung)                  | **Eigener Server** ([INSTALL.md](../../INSTALL.md)) |
| -------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Was ihr braucht                  | Admin-Zugang zu eurem ChurchTools – sonst nichts   | Einen Server mit Docker (z. B. eine NAS)            |
| Anmelden                         | Wer in ChurchTools angemeldet ist, ist drin        | Eigene Anmeldung mit den ChurchTools-Zugangsdaten   |
| Wo sie liegt                     | Menüpunkt in ChurchTools (im Browser)              | Eigene Adresse, auf dem Homescreen installierbar    |
| Termine, Ablauf, Liedblatt       | ✓                                                  | ✓                                                   |
| Anmerkungen, Zoom, Tonart merken | ✓ (als Dateien an der eigenen Person, siehe unten) | ✓                                                   |
| Offline im Saal                  | –                                                  | ✓                                                   |
| Lied-Statistik, Suche im Text    | –                                                  | ✓                                                   |
| Ablauf und Lieder bearbeiten     | noch nicht (geplant)                               | ✓                                                   |
| In der ChurchTools-App am Handy  | – (ChurchTools zeigt Erweiterungen nur im Web)     | eigene App auf dem Homescreen                       |

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

## Rechte

- **Den Menüpunkt sehen:** Unter **Berechtigungen** gibt es für die Erweiterung das Recht
  **„„Musik App" sehen (view)"**. Gebt es den Gruppen oder dem Status, die die App nutzen sollen
  (z. B. eurem Musikteam).
- **Lieder und Abläufe:** Die App zeigt nur, was die Person in ChurchTools ohnehin sehen darf –
  Abläufe (`view agenda`) und Lieder (`view songcategory`) im Bereich **Events**.
- **Anmerkungen speichern:** Die App legt sie als Dateien an der **eigenen Person** ab. Dafür braucht
  die Person das Recht, ihre eigenen Personendaten zu bearbeiten (in unserer Test-Gemeinde kam es über
  den Status „Mitglied"). Fehlt es, sagt die App das; die Anmerkungen bleiben dann nur auf dem Gerät.

## Gut zu wissen

- **Wo die Anmerkungen liegen:** als Anhänge an der eigenen Person in ChurchTools (**Personen** → die Person öffnen → ganz unten **„Anhänge >>“**): je
  bemalter Liedseite ein Bild `musikapp_….png`, dazu eine Datei `musikapp_daten.json` (Tonart, Kapo,
  Zoom, Textnotizen, „gesehen"). **Mitglieder, die die Person sehen dürfen, können diese Anhänge
  öffnen** – die App kann ihre Sichtbarkeit nicht einschränken (über die Schnittstelle gemessen).
  Ändern oder löschen kann sie nur die Person selbst.
- **Kein Offline:** Im Saal ohne Netz gibt es in der Erweiterung keine Liedblätter. Wer das braucht,
  nimmt die Variante mit eigenem Server.
- **Last:** Jedes Gerät fragt ChurchTools selbst. Bremst ChurchTools (zu viele Anfragen), hält die App
  von sich aus eine Weile still, statt weiter anzufragen.

## Aktualisieren

Neue ZIP herunterladen → **Administration → Erweiterungen** → beim Eintrag „Musik App" auf den
**Stift** → neue **ZIP-Datei** hineinziehen → **Speichern**. Name und Kürzel nicht ändern.

## Entfernen

In **Administration → Erweiterungen** den Eintrag löschen. Die Anmerkungs-Dateien (`musikapp_…`) an
den Personen bleiben dabei liegen – wer sie nicht mehr braucht, löscht sie selbst: **Personen** → die Person öffnen → ganz unten **„Anhänge >>“**.

## Für Entwickler

Gebaut wird mit `npm run build:extension -w client` (Kürzel über `VITE_KEY`, Standard `musik-app`);
das Release hängt die ZIP automatisch an. Plan, Messungen und Entscheidungen:
[`docs/entwicklung/plan-extension.md`](../entwicklung/plan-extension.md).
