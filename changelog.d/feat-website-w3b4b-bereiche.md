### Neu (Website)

- **Bereich je Seite (W3b-4b):** Jede Seite gehört der Website oder einer eingerichteten Untergruppe. Die Leitung der Website wählt
  das in **Seite einstellen → Bereich**; eine neue Seite erbt den Bereich dessen, der sie anlegt (wer in mehreren Untergruppen ist,
  wählt im Fenster „Neue Seite“).
- **Untergruppen sehen nur ihre Seiten:** Seitenliste, „Im Menü“, „Freigaben“ und der Zähler am Reiter zeigen Mitgliedern einer
  Untergruppe nur die Seiten ihres Bereichs. Die Vorschau zeigt trotzdem Menü und Aussehen der ganzen Website. Wer an der Website
  mitarbeiten darf, aber in keiner ihrer Gruppen ist, bekommt einen Hinweis statt einer leeren Liste.
- **Die Leitung einer Untergruppe gibt ihre Seiten frei** – in die Kategorie ihres Bereichs, auch mit „Alles freigeben“. Aussehen,
  Einstellungen, Menü, eigenes HTML, Startseite und Bereich bleiben bei der Leitung der Website.
- **Seite verschieben:** Wurde der Bereich einer schon veröffentlichten Seite geändert, schreibt das nächste Freigeben sie in die neue
  Kategorie, liest nach und entfernt sie erst dann aus der alten. Klappt das Entfernen nicht, steht sie online im neuen Bereich und die
  Meldung sagt, dass sie zusätzlich noch im alten steht; unter „Freigaben“ bleibt sie als „Geändert“.

### Geändert (Website)

- **Online-Stand je Bereich:** Eine Seite wird mit der Veröffentlicht-Kategorie ihres Bereichs verglichen; liegt sie (auch) in einer
  anderen, gilt sie als „Geändert“. Löschen und offline nehmen entfernt eine Seite aus jeder Veröffentlicht-Kategorie, in der sie steht.
- **Adressen sind über alle Bereiche eindeutig** – auch gegenüber Seiten, die man selbst nicht sieht.
- **„Startseite anlegen“** hat nur noch die Leitung der Website; Redakteure lesen, wer es tut.
- **Wer darf was:** Die Auswahlfelder nennen die Gruppe („Stufe von Leiter in „Website – Jugend““), und der Knopf „Wer darf was“ im
  Hinweis beim Start springt direkt zu diesem Abschnitt.

### Intern (Website)

- `Zugang` ist jetzt `{ sieht, leitet }` (je „alle“ oder Untergruppen) statt `'admin' | 'leitung' | 'redakteur'`; alle Regeln in
  `shared/website/zugang.ts`. Neu `onlineSicht`/`OnlineKategorie` in `shared/website/freigabe.ts`, `bereicheAus` in `einrichten.ts`.
- Demo: `?demo=jugend-redakteur`, `?demo=jugend-leitung`, `?demo=bereiche` (dort gelten die Rechte auch an den Werten).
- Mails je Bereich folgen mit W3b-4c; bis dahin findet ein Redakteur, der nur in einer Untergruppe ist, keine Leitung (keine Mail).
