### Intern

- **Anmeldungen: Bedingungen im Baukasten einstellen** (Etappe F, Scheibe F1c; noch nicht freigegeben, veröffentlicht
  wird erst nach Etappe F). Nach dem abgenommenen Entwurf `f1-bedingungen-nachweise-v1`, Ansicht 1:
  - An jeder Frage der Knopf „Nur zeigen, wenn …“ / „Bedingung ändern“, an jeder Antwort ein Pfeil für „nur wählbar,
    wenn …“ (auch bei Ja/Nein). Beide öffnen ein Fenster: beliebig viele Bedingungen, „eine reicht / alle müssen“, bei
    Antworten „ausgrauen mit Hinweis“ oder „ausblenden“. „Speichern“ speichert sofort. Als Quelle bietet das Fenster
    nur Fragen davor an (`moeglicheQuellen`).
  - Unter jedem Feld steht, wann es erscheint und welche Antworten nur unter Bedingung wählbar sind; links eine blaue
    Linie. Was an einer Bedingung nicht stimmt, steht rot darunter.
  - Freiwilliger **Kurzname** für Fragen, auf die eine Bedingung schaut (Alwin, 12.11.2026) – grau vorbelegt mit der
    automatischen Kürzung.
  - **Bedingungen ziehen mit:** Wird eine Antwort umbenannt, ziehen die Bedingungen darauf und daran mit. Wird eine
    Antwort oder Frage entfernt oder ausgeschaltet, fällt die Bedingung mit weg (Alwin, 12.11.2026), und die Meldung
    nennt die betroffene Frage; „Rückgängig“ holt alles zurück. Dasselbe beim Ausschalten des Geburtsdatums (`mitWer`)
    und beim Wechsel des Fragetyps. Bis F1c hätte so eine Änderung jedes weitere Speichern blockiert
    (`bedingungFehler`).
  - **Verschieben gesperrt,** wenn danach eine Quelle hinter ihrer Bedingung stünde (Alwin, 12.11.2026): „„Taufe“ muss
    vor „Bereich“ bleiben – dort ist sie Bedingung.“ – im Baukasten und beim Speichern (`feldEinordnen` → 409).
  - Die Feldgrenze je Teil (`FELDER_MAX` = 60) steht in der Leiste; ist ein Teil voll, kommt kein Baustein mehr hinein.
  - Neu im Regel-Baustein (`shared/anmeldung/bedingungen.ts`): `kaputteStellen` (die EINE Prüfung hinter
    `bedingungFehler`), `bedingungenUmbenennen`, `bedingungenAufraeumen`, `bedingungenNachziehen`, `verschiebenSperre`,
    `weggefallenText`, `istQuelle`, `bedingungSatz`, `umbenannteAntworten`.
  - Nebenbei behoben: Wurde ein Feld gesichert und im selben Klick verschoben, las der zweite Schritt den Stand vom
    letzten Zeichnen – die eben getippte Änderung fehlte kurz in der Anzeige (`setLokalF` im Baukasten).
