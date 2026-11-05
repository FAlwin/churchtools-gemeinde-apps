### Intern (alle Apps)

- **zod 4.6.7 statt 3.25** (#849, GHSA-mrhx-c7xc-m3w5: Speicher bei übergroßen Sammlungen; nur angemeldet erreichbar).
  `npm audit --omit=dev` meldet jetzt 0 Schwachstellen. Alle Schemas laufen unverändert; ein Vergleich zod 3 ↔ 4 an den
  genutzten Mustern fand nur zwei Unterschiede: `datetime({ offset: true })` lehnt Zeiten ohne Sekunden und Abstände
  ohne Doppelpunkt ab (ChurchTools liefert beides nicht, gemessen), und die englischen Standard-Fehlertexte lauten
  anders. Der Fehler-Handler nutzt `z.flattenError` statt des veralteten `err.flatten()`.
