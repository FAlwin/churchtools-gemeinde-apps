### Geändert (alle Apps)

- **PDF-Schrift kleiner:** Die Schrift der PDFs (Organigramm, Dienstplaner-Blätter, Protokolle) ist jetzt auf Latein,
  Kyrillisch und Satzzeichen gekürzt – sie sieht aus wie bisher. Die Erweiterungs-ZIPs werden dadurch deutlich kleiner;
  das Protokolle-ZIP mit dem neuen PDF (S6-3) passte vorher nicht in ChurchTools (3,2 MB wurden nicht ausgeliefert).
  Griechisch und Vietnamesisch stehen in PDFs nicht mehr zur Verfügung.

### Intern (PDF-Schrift)

- Die vier Lato-Schnitte (2.015) heißen gekürzt **„Gemeinde Sans“** (`ui/teilen/schrift/GemeindeSans-*.ttf`, `PDF_SCHRIFT
= 'GemeindeSans'`): Die Lizenz (SIL OFL) reserviert den Namen „Lato“ für unveränderte Fassungen. Erzeugt mit
  `scripts/schrift-kuerzen.py` (fonttools, nur einmalig), Herkunft und Prüfsummen in `schrift/HERKUNFT.md`.
  `latoEinbetten`/`latoKursivEinbetten` heißen jetzt `schriftEinbetten`/`kursivEinbetten`.
- Neuer Test `ui/teilen/schrift.test.ts`: alle nötigen Zeichen (Umlaute, „“ – …, €, Nachbarländer, Russisch, Ukrainisch)
  in jedem Schnitt, kein „Lato“ im Namen.
