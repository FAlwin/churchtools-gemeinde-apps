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
| Ablauf bearbeiten, Tempo         | ✓ (ab v2.29.0)                                     | ✓                                                   |
| Lieder verwalten, Notenblätter   | ✓ (ab v2.29.0, ohne SongSelect)                    | ✓                                                   |
| Links, Standard-Ansicht (Admin)  | ✓ (ab v2.29.0, gespeichert in ChurchTools)         | ✓                                                   |
| Team-Notizen („Notizen von …")   | ✓ (ab v2.29.0, Rechte siehe unten)                 | ✓                                                   |
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
  Abläufe (`view agenda`) und Lieder (`view songcategory`) im Bereich **Events**. Ebenso beim Ändern:
  den Ablauf bearbeitet nur, wer `edit agenda` hat, Lieder, Arrangements, Notenblätter und das Tempo
  nur, wer Lieder in der jeweiligen Kategorie bearbeiten darf (`edit songcategory`). Die App schreibt mit der Sitzung der Person – mehr als in ChurchTools selbst
  darf sie also nie.
- **Gemeinde-Einstellungen** (unter **Mehr → Verwaltung**, nur für Admins: Links und „Liedblatt:
  Standard-Ansicht"): Die App legt sie beim ersten Speichern in ChurchTools ab, in den Daten der
  Erweiterung unter der Kategorie **„Einstellungen der Musik App"**. Damit sie bei allen ankommen,
  braucht die Gruppe bzw. der Status eurer Musiker unter **Berechtigungen** für die Erweiterung die
  Rechte **„view custom category"** und **„view custom data"** für diese Kategorie. Fehlen sie, gibt es
  keine Fehlermeldung – es gilt dann einfach die Vorgabe („Akkorde", keine Links). Die Kategorie nicht
  löschen; sie gehört der App.
- **Team-Notizen** (Musiker sehen die Anmerkungen der anderen unter „Notizen von …"): Ein Admin wählt
  unter **Mehr → Verwaltung → Anmerkungen** die Gruppen und je Gruppe die Rollen, die mitmachen. Beim
  Speichern legt die App die Kategorie **„Team-Notizen der Musik App"** an – das Verzeichnis, wer seine
  Anmerkungen teilt. Die Musiker brauchen dafür **zusätzlich** auf dieser Kategorie „view custom
  category", „view custom data", **„create custom data"** und **„delete custom data"**: Wer unter
  **Mehr** „Meine Anmerkungen teilen" einschaltet, trägt sich dort ein (und beim Ausschalten wieder
  aus). Ob jemand wirklich teilt, steht in seiner eigenen Datei `musikapp_daten.json` – die kann nur er
  selbst ändern; ein Eintrag, den jemand von Hand macht, bewirkt also nichts.
- **Ohne Rechte für Lieder und Abläufe** (Bereich **Events**: „view songcategory", „view agenda")
  meldet die App derzeit „Berechtigungen konnten nicht geladen werden" statt eines klaren Hinweises.
  Wer die Musik App nutzen soll, braucht diese Rechte.
- **Anmerkungen speichern:** Die App legt sie als Dateien an der **eigenen Person** ab. Dafür braucht
  die Person das Recht, ihre eigenen Personendaten zu bearbeiten (in unserer Test-Gemeinde kam es über
  den Status „Mitglied"). Fehlt es, sagt die App das; die Anmerkungen bleiben dann nur auf dem Gerät.

## Gut zu wissen

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
