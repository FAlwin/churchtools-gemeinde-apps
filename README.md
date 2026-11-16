<p align="center">
  <img src="client/public/icon-192.png" width="96" alt="Symbol der Musik App">
</p>

<h1 align="center">Gemeinde-Apps für ChurchTools</h1>

<p align="center">
  Chord Charts, Dienstpläne, Organigramm und Gebetsabend – direkt mit eurem ChurchTools verbunden.<br>
  Kostenlos, quelloffen, ohne eigene Datenbank.
</p>

<p align="center">
  <a href="https://github.com/FAlwin/churchtools-gemeinde-apps/releases/latest"><img src="https://img.shields.io/github/v/release/FAlwin/churchtools-gemeinde-apps?filter=v*&label=Musik-App" alt="Musik-App Version"></a>
  <img src="https://img.shields.io/badge/ChurchTools-Erweiterung-2b6cb0" alt="Läuft als ChurchTools-Erweiterung">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/FAlwin/churchtools-gemeinde-apps" alt="MIT-Lizenz"></a>
</p>

<p align="center">
  <a href="https://github.com/FAlwin/churchtools-gemeinde-apps/releases/latest"><strong>Musik-App herunterladen</strong></a>
  &nbsp;·&nbsp;
  <a href="#die-apps">Alle Apps</a>
  &nbsp;·&nbsp;
  <a href="docs/betrieb/ERWEITERUNG.md">So installiert ihr sie</a>
</p>

<p align="center">
  <img src="docs/bilder/musik-demo.gif" width="480" alt="Die Musik App: Ein Lied wird von G nach A transponiert und als reiner Text angezeigt">
</p>

---

Die Apps holen ihre Daten aus dem ChurchTools eurer Gemeinde und schreiben dorthin zurück. Es gibt keine
zweite Datenbank und keine zentrale Stelle: Jede Gemeinde installiert die Apps selbst, jede Person meldet sich
mit ihren eigenen ChurchTools-Zugangsdaten an und sieht nur, was ihre Rechte erlauben.

> **Hinweis:** Dies ist ein **inoffizielles Community-Projekt** und steht in keiner Verbindung
> zur ChurchTools GmbH. „ChurchTools" ist eine Marke der jeweiligen Inhaber. Die Namen der Apps
> sind rein beschreibend gemeint („Musik-App **für** ChurchTools").

## Die Apps

Alle Apps gibt es als **ChurchTools-Erweiterung**: ein ZIP, das ihr in ChurchTools unter
_Administration → Erweiterungen_ hochladet. Die Musik-App läuft außerdem auf einem eigenen Server
(dann auch offline und als App auf dem Home-Bildschirm).

| App              | Wofür                                                                             | Download                                                                                        | Anleitung                                                         |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Musik-App**    | Chord Charts der Setlist, automatisch transponiert; Ablauf, Lieder, Abwesenheiten | [ZIP herunterladen](https://github.com/FAlwin/churchtools-gemeinde-apps/releases/latest)        | [Erweiterung](docs/betrieb/ERWEITERUNG.md) · [Server](INSTALL.md) |
| **Dienstplaner** | Dienste aller Gruppen planen, zusagen, tauschen; freie Plätze auf einen Blick     | [ZIP herunterladen](https://github.com/FAlwin/churchtools-gemeinde-apps/releases?q=dienstplan)  | [Anleitung](docs/betrieb/DIENSTPLANER.md)                         |
| **Organigramm**  | Bereiche, Gruppen und Leitung als Baum, Karten oder Mindmap – auch als PDF        | [ZIP herunterladen](https://github.com/FAlwin/churchtools-gemeinde-apps/releases?q=organigramm) | [Anleitung](docs/betrieb/ORGANIGRAMM.md)                          |
| **Gebetsabend**  | Gebetsabend als Audio-/Video-Übertragung nur für Mitglieder                       | [ZIP herunterladen](https://github.com/FAlwin/churchtools-gemeinde-apps/releases?q=gebetsabend) | [Anleitung](docs/betrieb/GEBETSABEND.md)                          |

**In Arbeit:** [Anmeldungen](docs/betrieb/ANMELDUNGEN.md) (Ersatz für Jotform & Co.) und
[Protokolle](docs/betrieb/PROTOKOLLE.md) (Sitzungen mit To-Dos und Beschlüssen).

## So sieht es aus

<table>
  <tr>
    <td width="72%"><img src="docs/bilder/musik-liedblatt.png" alt="Musik-App am iPad quer: zwei Liedblätter nebeneinander"></td>
    <td width="28%"><img src="docs/bilder/musik-handy.png" alt="Musik-App am Handy"></td>
  </tr>
  <tr>
    <td align="center">Musik-App am iPad</td>
    <td align="center">… und am Handy</td>
  </tr>
</table>

<table>
  <tr>
    <td width="33%"><img src="docs/bilder/dienstplaner-start.png" alt="Dienstplaner: Startseite mit dem nächsten Dienst und offenen Anfragen"></td>
    <td width="33%"><img src="docs/bilder/organigramm-karten.png" alt="Organigramm: Bereiche und Gruppen als Karten"></td>
    <td width="33%"><img src="docs/bilder/gebetsabend-technik.png" alt="Gebetsabend: Übertragung starten"></td>
  </tr>
  <tr>
    <td align="center">Dienstplaner</td>
    <td align="center">Organigramm</td>
    <td align="center">Gebetsabend</td>
  </tr>
</table>

Die Bilder zeigen Beispieldaten aus dem Demo-Modus der Apps.

## Was die Musik-App kann

- **Chord Charts aus ChurchTools**, automatisch in der richtigen Tonart, mit Kapo – auch als PDF zum Teilen
- **Ablauf bearbeiten**, Lieder suchen und einfügen, Notenblätter aus CCLI SongSelect holen
- **Anmerkungen** mit Stift und Marker, auf Wunsch mit dem Team geteilt
- **Offline im Saal** und als App auf dem Home-Bildschirm (eigener Server)

<details>
<summary><strong>Alle Funktionen im Detail</strong></summary>

- **Ablaufpläne & Setlists** aus ChurchTools anzeigen (kompletter Ablauf, nicht nur Lieder)
- **Ablauf bearbeiten** (mit dem ChurchTools-Recht dafür): Punkte und Lieder anlegen, ändern, löschen und
  per Ziehen sortieren, Vorlauf vor dem Beginn festlegen, Ablauf abschließen und wieder öffnen;
  Löschen und Verschieben lassen sich kurz danach **rückgängig** machen
- **Chord Charts als PDF** (SongSelect-Look) mit automatischer Transponierung, Kapo, Spalten- und
  Schrift-Optionen; im Querformat zwei Seiten nebeneinander, als PDF teil-/druckbar
- **Alle Lieder** durchsuchbar inkl. Nutzungs-Statistik (Häufigkeit / zuletzt gespielt, mit
  wählbarem Zeitraum). Gesucht wird in Titel und Autor, Titel-Treffer stehen vorn; findet der Titel
  nichts, lässt sich **auch im Liedtext** suchen – für den Fall, dass man nur eine Zeile kennt
- **Beim Einfügen eines Liedes: ein Suchfeld, eine Liste** – Titel, Autor oder CCLI-Nummer tippen, eigene
  Lieder oben, SongSelect darunter; jede Zeile mit Auge (Vorschau) und Plus (einfügen). Findet die
  Bibliothek nichts, sucht SongSelect von selbst mit – auch beim **Verknüpfen** eines Ablaufpunkts
  mit einem Lied
- **Liedtext-Vorschau vor dem Einfügen** – ein Antippen zeigt erst den Text, dann den Knopf zum
  Hinzufügen; so unterscheidet man gleichnamige Lieder, ohne sie zu öffnen. Bei SongSelect mit
  Abschnitten, Autoren und CCLI-Nummer. Für den Alltag bleibt der **„+"**-Knopf: sofort einfügen
- **Lieder anlegen** – über die Quelle **SongSelect** gefunden (Titel oder CCLI-Nummer; Autoren,
  Copyright und Tonart kommen mit, das Notenblatt gleich dazu) oder über „Neues Lied" selbst
  eingetippt. Aus dem Liederheft, direkt beim Ergänzen eines Ablaufs oder beim Verknüpfen. Trägt ein
  Lied der Bibliothek schon dieselbe CCLI-Nummer, fragt die App, ob das vorhandene verwendet werden soll
- **Stammdaten pflegen** – Name, Kategorie, Autor, CCLI-Nummer und Copyright eines vorhandenen Liedes
  ändern; Löschen mit Rückfrage, die die Folgen nennt
- **Live-Aktualisierung**: Änderungen am Ablauf erscheinen zeitnah bei allen; ein kurzer Hinweis unten
  nennt, was neu, geändert oder entfernt ist, und markiert die betroffenen Punkte für ein paar Sekunden
- **Mehrere benannte Lied-Versionen** (z. B. „Akustik", „Jugend") – team-weit in ChurchTools,
  Original bleibt erhalten. Der **Editor arbeitet in der Tonart, die gerade auf dem Blatt steht**;
  jede Version kennt ihre eigene Tonart
- **Anmerkungen, Zoom & Einstellungen pro ChurchTools-Konto** – geräteübergreifend synchronisiert
  (Stift/Marker/Text auf den Seiten, Rückgängig/Wiederholen); optional **mit dem Team teilen**
- **Offline-Reserve**: einmal geladene Abläufe/Charts sind ohne Netz im Saal verfügbar; als App
  installierbar (Home-Bildschirm)
- **Hochgeladene PDFs/Bilder** je Lied – direkt im durchgehenden Ablauf (mitwischen, im Querformat
  neben dem Nachbarlied) und ebenfalls mit Anmerkungen
- **Dateien eines Arrangements verwalten** – ansehen, aufs Gerät laden, hinzufügen und löschen,
  ohne den Umweg über die ChurchTools-Oberfläche
- **Arrangements verwalten** – Name, Quelle, Liednummer, Tonart, Tempo, Takt, Länge und Beschreibung
  im Stammdaten-Blatt ändern, weitere Arrangements anlegen, zum Standard machen, löschen mit Rückfrage
- **Notenblatt aus CCLI SongSelect holen** – wenn die Gemeinde die SongSelect-Integration in
  ChurchTools aktiviert hat und das Lied eine CCLI-Nummer trägt; in der Tonart des Arrangements
  (was dabei aufs SongSelect-Kontingent zählt: [docs/betrieb/songselect-kontingent.md](docs/betrieb/songselect-kontingent.md))
- **Abwesenheiten** – Musikerinnen und Musiker tragen je Termin per Häkchen oder als Zeitraum ein,
  wann sie fehlen; gespeichert wird direkt in ChurchTools. Termine lassen sich nach Art filtern
  (z. B. nur Gottesdienste); die Arten pflegt der Admin. Sichtbar für Mitglieder der gewählten
  Musikteam-Gruppen
- **Rechtebewusste Oberfläche** – jede Person sieht nur, wozu ihre ChurchTools-Rechte passen
- **Geführte Einführung** (Onboarding-Touren) beim ersten Öffnen
- **Frei konfigurierbare Links** (z. B. zu weiteren Gemeinde-Angeboten) im „Mehr"-Tab und optional
  auf der Login-Seite

</details>

## Für andere Gemeinden

Jede Gemeinde betreibt ihre **eigene, eigenständige Instanz** – mit ihrer ChurchTools-Verbindung
und ihrem Gemeindenamen. Es gibt **keine zentrale Infrastruktur** und keinen geteilten Zugang:
Jede App spricht ausschließlich mit dem ChurchTools der eigenen Gemeinde, jede Person meldet sich
mit ihren **eigenen ChurchTools-Zugangsdaten** an.

Anpassbar sind nur:

| Was                                          | Wo                              |
| -------------------------------------------- | ------------------------------- |
| ChurchTools-URL, Session-Secret, Admin-Recht | `.env` auf eurem Server         |
| Gemeindename + eigene Links                  | in der App (Admin → „Mehr"-Tab) |
| Liedblatt zuerst als Akkorde oder PDF        | in der App (Admin → „Mehr"-Tab) |

Optik und Funktionen sind für alle identisch (eine gemeinsame Codebasis).

**Ohne eigenen Server?** Die App gibt es auch als **ChurchTools-Erweiterung** – ein ZIP, das ihr in
ChurchTools hochladet; angemeldet ist man dann über ChurchTools selbst. Sie kann weniger (kein Offline,
keine Suche im Liedtext) und läuft nur im Browser, nicht in der ChurchTools-App:
**[Anleitung zur Erweiterung](docs/betrieb/ERWEITERUNG.md)**.

## Schnellstart

Die App läuft als fertiges Docker-Image – kein eigener Build nötig:

```bash
# 1. Verteilpaket aus dem Ordner deploy/ holen (docker-compose.yml + .env.example)
# 2. .env ausfüllen (eigene ChurchTools-URL + Session-Secret)
docker compose up -d
```

Ausführliche Anleitung: **[INSTALL.md](INSTALL.md)** · Updates: **[UPDATE.md](UPDATE.md)**

## Lizenz & Haftung

Veröffentlicht unter der **[MIT-Lizenz](LICENSE)** – Nutzung, Anpassung und Weitergabe sind frei.
Die Software wird **ohne jede Gewährleistung** bereitgestellt (siehe Lizenztext).

Jede Gemeinde ist für ihre eigene Instanz, ihren ChurchTools-Zugang und die **Einhaltung der
DSGVO** selbst verantwortlich.
