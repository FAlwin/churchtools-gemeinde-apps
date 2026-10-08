# SongSelect: Was zählt aufs Kontingent?

Kurz zusammengefasst für Gemeinden, die die Musik App mit CCLI SongSelect nutzen (ChurchTools-Stammtisch,
08.10.2026). Stand der Quellen: CCLI-Support USA, zuletzt aktualisiert April 2023.

## Was die 200 bedeuten – und was nicht

- Ihr könnt im Abo-Jahr von **200 verschiedenen Liedern Notenblätter herunterladen oder drucken**
  (Akkorde, Lead Sheet, Vocal Sheet) – **jedes davon beliebig oft**, auch in anderen Tonarten.
- **Nicht** gemeint ist, wie viele Lieder ihr nutzen, in Abläufe einfügen oder singen dürft. Ob ein Lied
  öffentlich gesungen werden darf, regelt die **CCLI-Lizenz** der Gemeinde (Gottesdienst-Lizenz mit
  Liedmeldung) – ein eigener Vertrag, unabhängig vom SongSelect-Abo.
- Notenblätter, die schon in ChurchTools liegen, kosten beim Öffnen, Teilen oder Transponieren nichts mehr.
  Gezählt wird nur der Abruf bei SongSelect.

## Die Regeln von CCLI

- Die Abos **Advanced** und **Premium** enthalten **200 verschiedene urheberrechtlich geschützte Lieder
  pro Abo-Jahr**. Gezählt wird **je Lied** (eigene CCLI-Nummer), nicht je Anfrage oder Download.
- Ein Lied zählt beim **ersten Herunterladen oder Ausdrucken** von **Akkorden, Lead Sheet oder Vocal
  Sheet**. Weitere Kopien desselben Lieds im selben Abo-Jahr zählen nicht – auch nicht in einer anderen
  Tonart.
- **Liedtexte** und **gemeinfreie Lieder** sind **unbegrenzt**.
- Ruft ein angebundenes Programm (ChurchTools, diese App) Akkorde oder Lead Sheets ab, **zählt das als
  Download** – auch wenn man sie dort nur ansehen will. Ohne Verbrauch ansehen geht nur direkt auf der
  SongSelect-Seite.
- Mehr Lieder lassen sich in Paketen zu je 50 nachkaufen. Bei der Verlängerung wird wieder auf 200
  gesetzt; Reste verfallen.
- Eine Grenze für die **Zahl der Anfragen** (Suchen) haben wir nirgends gefunden.

## Was die Musik App bei SongSelect tut

| Aktion in der App                                                   | Fragt SongSelect?                     | Zählt aufs Kontingent?                                   |
| ------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| Lied suchen, Trefferliste durchsehen                                | ja (Suche)                            | nein – kein Download                                     |
| Lied per CCLI-Nummer abfragen (Titel, Autoren, Copyright)           | ja                                    | nein                                                     |
| **Vorschau (Auge) bei einem Lied aus eurer Bibliothek**             | **nein** – Text aus ChurchTools       | nein                                                     |
| Vorschau (Auge) bei einem Treffer, der nur bei SongSelect ist       | ja (Liedtext)                         | laut CCLI nein – Texte sind unbegrenzt                   |
| **Notenblatt aus SongSelect holen** (beim Anlegen oder im Liedmenü) | ja (ChordPro)                         | **sehr wahrscheinlich ja** – einmal je Lied und Abo-Jahr |
| Das geholte Notenblatt öffnen, teilen, transponieren                | nein – liegt als Datei in ChurchTools | nein                                                     |

**Die Vorschau im Detail:** Beim Hinzufügen eines Lieds zum Ablauf zeigt das Auge den Text.

- Ist das Lied **schon in eurer Bibliothek**, kommt der Text aus der Notenblatt-Datei in ChurchTools.
  SongSelect wird dabei überhaupt nicht gefragt.
- Kommt das Lied **nur aus SongSelect** (Treffer unter der Bibliothek), holt das Auge den Liedtext bei
  SongSelect. Laut CCLI sind Liedtexte unbegrenzt – das verbraucht also kein Kontingent.
- **In beiden Fällen** wird erst gefragt, wenn das Auge angetippt wird. Beim Durchsehen der Liste geht keine
  einzige Anfrage raus, und dasselbe Lied wird je Sitzung nur einmal abgefragt.

## Was noch offen ist

- **ChordPro** nennt CCLI in der Zählregel nicht ausdrücklich (dort steht „Chords, Lead Sheets, Vocal
  Sheets"). Es ist ein Akkordformat – deshalb gehen wir davon aus, dass es zählt. Bestätigt ist das nicht.
- **Ob ein Textabruf in der Nutzungs-Historie** des SongSelect-Kontos erscheint, ist unbekannt. Aufs
  Kontingent zählt er laut CCLI nicht.
- Die Zahlen stammen von **CCLI USA**. Die Bedingungen in Deutschland können abweichen.

**So lässt es sich verlässlich klären:** im SongSelect-Konto der Gemeinde einmal ein Notenblatt über
ChurchTools holen und danach in der Download-Übersicht nachsehen, ob der Zähler gestiegen ist – oder beim
CCLI-Support nachfragen.

## Quellen

- [Is there a limit to how many songs I can download from SongSelect®](https://support-ccli-us.helpscoutdocs.com/article/323-is-there-a-limit-to-how-many-songs-i-can-download-from-songselect) (CCLI-Support)
- [What is a unique download?](https://support-ccli-us.helpscoutdocs.com/article/328-what-is-a-unique-download) (CCLI-Support)
- [Why do I lose a song credit when I try to view a song?](https://support-ccli-us.helpscoutdocs.com/article/1081-why-do-i-lose-a-song-credit-when-i-try-to-view-a-song) (CCLI-Support)
- [What is ChordPro and how do I use it?](https://support-ccli-us.helpscoutdocs.com/article/1113-what-is-chordpro-and-how-do-i-use-it) (CCLI-Support)
- [Songselect CCLI Integration – Lizenzfrage](https://forum.church.tools/post/17754) (ChurchTools-Forum, Erfahrungswerte)

Technische Messungen der App: [`docs/entwicklung/churchtools-songselect.md`](../entwicklung/churchtools-songselect.md).
