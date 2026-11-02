### Neu (Dienstplaner, T2a – Alwin, 02.11.2026)

- **Dateien am Termin** – die Büroklammer aus der Dienstplan-Liste von ChurchTools: Im Kopf der Termin-Ansicht steht sie
  neben dem ⓘ mit der Zahl der Dateien; antippen öffnet das Fenster „Dateien“ mit Art und Größe, ein Tipp öffnet die
  Datei bzw. den Link aus ChurchTools. In der Matrix steht unter den Infos je Datei eine Zeile (höchstens drei, dann
  „+ N weitere“), die dasselbe Fenster öffnet. Die Dateien kommen mit der Terminliste, ohne zusätzliche Anfrage; die
  Größe lädt das Fenster frisch nach – klappt das nicht, bleibt der bekannte Stand stehen. Dateien auf fremden Hosts und
  Links ohne `http(s)` führen nirgendwohin. Hochladen, Link anhängen, Umbenennen und Löschen folgen mit T2b.
  Testfall TF-ABLAUF-18.

### Intern (Dienstplaner)

- Die Dateizeile der Lied-Ansicht ist jetzt ein gemeinsamer Baustein (`ui/dateien/DateiZeile`), die Dateien am Termin
  benutzen ihn mit. `KopfKnopf` kann eine Zahl neben dem Symbol zeigen (`zahl`), auch am Handy.
