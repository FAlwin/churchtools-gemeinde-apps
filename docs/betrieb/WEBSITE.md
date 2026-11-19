# Website – ChurchTools-Erweiterung

> **Stand: W3a-1 (20.11.2026) – noch kein Release.** Gebaut ist das Grundgerüst: Die Erweiterung lässt sich installieren und
> **einrichten**, zeigt die **Seitenliste** und eine **Vorschau** (echter Renderer), und man kann **Seiten anlegen und
> löschen**. Noch **nicht** da: Inhalte bearbeiten (W3a-2), Aussehen – Farben, Schriften, Logo (W3a-3), Bilder (W4),
> Freigabe und Rechte für Redakteure (W3b), Veröffentlichen (W5). Das Bild der ganzen Website: Bauplan „Neue Website“
> (Second Brain, `ecg-donrath/website/bauplan-neue-website.md`).

Die Website einer Gemeinde wird in ChurchTools gepflegt – ohne Code. Die Erweiterung speichert Seiten, Menü und
Einstellungen im Speicher von ChurchTools; später baut ein Bau-Dienst daraus die fertigen Seiten für den Webspace. Es gibt
**keinen eigenen Server** in der Erweiterung. Die Vorschau erzeugt das HTML mit **demselben Code** (`shared/website/`), den
später der Bau-Dienst benutzt – so sieht die Vorschau aus wie die Website.

## Installieren

> **Vorher einmalig:** Erweiterungen muss der ChurchTools-Support für eure Instanz freischalten – siehe
> [Erweiterungen freischalten](ERWEITERUNG.md#erweiterungen-freischalten).

1. Das Paket bauen (`npm run build -w website && npm run paket -w website`, ergibt `website/releases/website-<Version>.zip`)
   oder – sobald es einen Release gibt – bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases)
   die Datei **`website-v….zip`** herunterladen (nicht entpacken).
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Website“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`website`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/website/`); mit einem anderen
     Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die Datei aus Schritt 1.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen. ChurchTools speichert die Dateien einer Erweiterung
**7 Tage** im Browser zwischen; die Dateinamen tragen deshalb einen Fingerabdruck – unten auf der Seite steht die Version.

## Einrichten

Einmal, von einem **Admin** (Recht „Gruppen verwalten“, dazu bei der Erweiterung „Kategorien erstellen“):

1. In ChurchTools eine **Gruppe „Website“** anlegen (oder eine vorhandene wählen) – dort arbeitet das Website-Team. Die
   **Leitung** dieser Gruppe darf die Website bearbeiten.
2. Die Erweiterung öffnen. Sie zeigt „Website einrichten“ mit einer Auswahl der Gruppen (eine Gruppe namens „Website“ ist
   vorgewählt) und dem Knopf **Einrichten**.
3. **Einrichten** legt zwei Kategorien im Speicher der Erweiterung an – nacheinander, jede erst nach Nachsehen und danach
   nachgelesen:
   - **„Website: Entwürfe · <Gruppe>“** (Kürzel `entwuerfe-g<ID>`) – die Arbeitsfassung.
   - **„Website: Veröffentlicht · <Gruppe>“** (Kürzel `veroeffentlicht-g<ID>`) – die freigegebene Fassung; in W3a-1 noch leer.

   Die **Gruppe steckt im Kürzel**: So erfährt die Erweiterung, welche Gruppe gewählt wurde, ohne etwas Zusätzliches zu
   speichern. Gibt es mehrere solcher Kategorien, gilt die mit der kleinsten Kategorie-ID.

4. Ist nur eine der beiden Kategorien da (ein früherer Versuch ist abgebrochen), ergänzt **Einrichten** die fehlende – die
   Gruppe steht dann fest.

## Wer darf was – Stand W3a-1

| Wer                                                    | sieht / darf                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Admin** („Gruppen verwalten“)                        | einrichten, alle Seiten sehen, anlegen, löschen                                              |
| **Leitung der gewählten Gruppe** (Rolle mit „Leitung“) | alle Seiten sehen, anlegen, löschen – **sobald ChurchTools ihr die Kategorie zeigt** (s. u.) |
| Mitarbeiter der Gruppe, alle anderen                   | freundlicher Hinweis, wer die Website bearbeiten darf; kein Editor                           |

**Wichtig – zwei getrennte Schichten:**

1. Die **Oberfläche** zeigt den Editor nur Admins und der Leitung der Gruppe (`shared/website/zugang.ts`). Leitung ist, wer
   eine **aktive** Mitgliedschaft mit einer Rolle hat, die ChurchTools als Leitung führt (`isLeader`). Die Rechteabfrage
   `GET /permissions/internal/groups/{id}` taugt dafür nicht: Sie meldet einzelne Rechte (z. B. `+create group`), die auch
   Organisatoren haben, die keine Leitung sind.
2. Der **Schutz der Daten** sind allein die **Rechte an den Kategorien** in ChurchTools. Die setzt in W3a-1 **die Verwaltung von
   Hand**: unter _Administration → Berechtigungen_ bei der Erweiterung „Website“ für die **Leiter-Rolle der Gruppe**
   „Modul sehen“ und für die Kategorie „Entwürfe“ „Daten sehen“, „anlegen“, „ändern“, „löschen“. Ohne diese Rechte sieht die
   Leitung die Kategorien nicht – die Erweiterung zeigt ihr dann „noch nicht eingerichtet, oder dir fehlt das Recht“. Das
   Setzen an den Rollen übernimmt mit **W3b** die Erweiterung selbst (wie beim Organigramm).

Die Kategorie „Veröffentlicht“ bekommt in W3a-1 **keine** Schreibrechte außer für Admins.

## Wie die Daten im Speicher liegen

Alle Seiten, das Menü und die Einstellungen liegen in der Kategorie „Entwürfe“. **Ein Wert fasst höchstens 10.000 Zeichen**
(gemessen W0, 19.11.2026; Zeichen, nicht Bytes). Deshalb besteht jede **Einheit** (eine Seite, das Menü, die Einstellungen)
aus einem **Kopf** und **Teilen**:

- **Kopf** (`website-kopf`): Art der Einheit (`seite`, `menue`, `einstellungen`), ihre Kennung (bei Seiten die Seiten-ID, sonst
  fest `menue` / `einstellungen`), der **Stand** (Prüfsumme des Inhalts) und die Zeit der letzten Speicherung.
- **Teile** (`website-teil`): der Inhalt – der Text aus `shared/website/modell.ts` mit der Kennung `website:v1:` –, gepackt
  (deflate + Base64url) und in Stücke von höchstens 9.500 Zeichen geschnitten. Jeder Teil trägt Einheit, Kennung und denselben
  Stand wie der Kopf. Die Aufteilung ist dieselbe wie bei den Protokollen (`shared/ct/teile.ts`).

**Lesen:** die **ganze Kategorie mit einem Aufruf** (gemessen: 156 Werte in 81 ms, kein Blättern), daraus setzt die Erweiterung
alles zusammen. Zu einem Kopf gehören nur die Teile mit **seinem Stand** – ein halb abgebrochenes Speichern ist so nie sichtbar.
Was nicht passt (fremder oder beschädigter Wert, Teile fehlen, ein zweiter Kopf, ungültiger Inhalt, neuere Formatversion),
steht oben in der Seitenliste als Hinweis **„Mit manchen Daten stimmt etwas nicht“** – es wird **gemeldet, nie still verworfen
und nie gelöscht**.

**Schreiben** (Reihenfolge wie bei den Protokollen): neue Teile → nachlesen → Kopf umstellen → nachlesen → alte Teile löschen.
Bricht es unterwegs ab, zeigt der Kopf weiter auf einen vollständigen Stand; nur das Aufräumen darf scheitern (das nächste
Speichern räumt mit auf). Ein „201 Erstellt“ gilt nicht als Beleg: Jeder Schritt wird nachgelesen, sonst wirft die Erweiterung
einen Fehler.

**Vorübergehend ist nicht ungültig:** Ein Fehler beim Lesen (Netz, 502/503/504) zeigt „Erneut versuchen“ und verändert nichts;
ein Fehler beim Speichern lässt den bisherigen Stand unberührt, und das Fenster bleibt mit der Eingabe offen.

**Löschen einer Seite:** erst das Menü ohne ihren Eintrag speichern (falls sie im Menü steht), dann der Kopf der Seite, dann
ihre Teile. Bleiben Teile liegen, sind sie unschädlich („verwaist“).

**Gleichzeitiges Bearbeiten:** Der Speicher von ChurchTools kennt keine Versionen; speichern zwei Personen dieselbe Seite
gleichzeitig, gewinnt die spätere. Eine **Sperre** (wer schreibt gerade) kommt mit dem Editor (W3a-2).

**Der eine Anschluss:** Alles, was die Erweiterung vom Speicher von ChurchTools braucht, steht in
`shared/website/speicher.ts` (und dort über `shared/ct/modulDaten.ts`). Ändert ChurchTools die Ablage (Dev-Plattform, Bauplan
§5), ist es genau diese Datei.

## Die Oberfläche

- **Reiter:** Seiten | Aussehen | Freigaben (am Computer oben, am Handy unten). „Aussehen“ und „Freigaben“ zeigen in W3a-1
  nur einen Hinweis „kommt“.
- **Seiten:** links die Liste („Im Menü“ in der Reihenfolge des Menüs, „Weitere Seiten“; die Startseite ist markiert), rechts
  die **Vorschau** mit dem Umschalter **Computer | Handy** (390 px).
- **Neue Seite:** Titel eingeben; der Pfad (die Adresse) entsteht daraus (Umlaute ausgeschrieben, bei Streit `-2`). Die Seite
  ist leer.
- **Seite löschen:** mit Rückfrage; steht sie im Menü, wird der Menüpunkt mit entfernt.
- **Startseite anlegen:** Hat die Website keine Startseite, steht ein Hinweis mit dem Knopf „Startseite anlegen“ (Vorlage
  `start-schriftzug`). Angelegt wird **nie von selbst**.
- Demo ohne ChurchTools (nur beim Entwickeln): `npm run dev -w website`, dann `…/ccm/website/?demo` (Fälle: siehe
  `website/src/demo.ts`).

### Vorschau und Sicherheit

Die Vorschau ist ein `iframe` mit `srcdoc` und **`sandbox="allow-scripts"` – ohne `allow-same-origin`**. Der Baustein „Eigenes
HTML“ (nur für die Leitung) bringt fremden Code mit; in dieser Sandbox hat er einen eigenen, leeren Ursprung und kommt weder an
ChurchTools noch an die Sitzung noch an die Erweiterung (`website/src/Vorschau.test.tsx` prüft das Attribut). Folgen:

- Das **Stylesheet** (`shared/website/website.css`) steckt als `data:`-Adresse im Dokument.
- **Keine Schriftdateien** in der Vorschau – die Seite fällt auf die Ersatzschrift zurück (Schriften kommen mit W3a-3).
- **Bilder** sind ein neutrales Platzhalter-Bild (echte Bilder: W4).
- Termine, Beiträge, Slider, Livestream und Gruppen sind in der Vorschau leer – der Renderer zeigt seine Leer-Hinweise.
- Links auf andere Seiten führen in der Vorschau nirgendwohin.

## Das Stylesheet

`shared/website/website.css` ist das **eine** Stylesheet für alle Gemeinden (aus dem abgenommenen Entwurf). Farben und
Schriften kommen nur aus den Variablen in `:root`, die das Theme jeder Seite setzt (`shared/website/theme.ts`); die Werte im
Blatt sind eine neutrale Vorgabe. Es liegt in `shared/` und nicht in der Erweiterung, damit der Bau-Dienst (W5) dieselbe Datei
benutzt. Es ist **Gemeinde-Design, nicht ChurchTools-Design** – die Quelltext-Wächter der Oberfläche (`ui/design/*`) gelten
dafür nicht. `shared/website/stylesheet.test.ts` prüft, dass jede Klasse, die der Renderer ausgibt, im Blatt eine Regel hat (oder
mit Begründung bewusst keine).

## Was noch fehlt

W3a-2 Inhalte bearbeiten (Abschnitte, Bausteine, Menü) · W3a-3 Aussehen (Farben, Schriften, Logo) · W3b Redakteure,
Untergruppen, Freigabe, Rechte an den Gruppenrollen · W4 Bilder · W5 Bau-Dienst und Veröffentlichen · Release
(`website-v…`; Tag erst nach grünem Merge, siehe `.github/workflows/website-release.yml`).

## Release

Wie bei den anderen Erweiterungen: erst in main mergen (CI grün), dann `git tag website-vX.Y.Z && git push origin
website-vX.Y.Z` – der Workflow baut, packt und legt einen Release mit der ZIP an (`make_latest: false`).
