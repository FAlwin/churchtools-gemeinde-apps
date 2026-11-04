### Geändert (Protokolle, K3a)

- **Werkzeugleiste in Gruppen** (Entwurf `k3-leiste-v1`, Variante B, Alwin 04.11.2026): Textart und Fett · Kursiv ·
  Unterstrichen · Durchgestrichen · Formatierung entfernen direkt, dahinter die Menüs **Markieren ▾ · Absatz ▾ ·
  Einfügen ▾**. Am Rechner eine Zeile; am Handy Fett und „Aa“ vorn, die Menüs als Zeichen (Absatz = Zeilen).
- **Textarten heißen neu:** Text · Tagesordnungspunkt · **Unterpunkt** (Überschrift 2) · **Überschrift** (Überschrift 3),
  in Leiste und „/“-Menü.
- **Nur noch To-Do:** Die Checkliste ist aus Leiste und „/“-Menü verschwunden; alte Checklisten bleiben lesbar. Der Knopf
  „Aufgabe“ heißt jetzt „To-Do“.

### Neu (Protokolle, K3a)

- **Markieren in allen Farben des Editors** – Hintergrund und Schrift, neun Farben, hell wie dunkel. Die Lese-Ansicht
  zeigt dieselben Farben (vorher nur „markiert“, egal welche Farbe).
- **Tabellen:** „Einfügen → Tabelle“ (auch im „/“-Menü) fügt drei Spalten mit Kopfzeile ein; Zeilen und Spalten über die
  Griffe, Kopfzeile/-spalte im Griff-Menü. Lese-Ansicht und Suche kennen sie; Tabellen aus Word bleiben Tabellen.

### Behoben (Protokolle, K3a)

- **Termin am Handy:** Der Text eines Termins stand als Buchstabensäule rechts neben dem blauen Kasten, die Seite ließ
  sich seitlich schieben (am iPhone gefunden, seit S4-2). Die Handy-Regel für die Schildchen gilt jetzt nur am To-Do; ein
  langes Wort ohne Leerzeichen bricht im Kasten um.

### Behoben (alle Apps)

- **Kein Hineinzoomen beim Antippen am iPhone:** Safari vergrößerte die Seite leicht, sobald man in ein Feld oder den
  Protokoll-Editor tippte (Schrift unter 16 px; Alwin, 04.11.2026). Jede App setzt auf iPhone und iPad jetzt
  `maximum-scale=1` (`ui/fenster/tippZoom.ts`) – Vergrößern mit zwei Fingern geht weiter; Android bleibt unberührt.

### Intern (Protokolle, K3a)

- Farben kommen aus BlockNote selbst (`COLORS_DEFAULT` / `COLORS_DARK_MODE_DEFAULT`, `protokolle/src/farben.ts`); die eine
  Abweichung (Gelb = `--markiert`) prüft `ui/design/markierFarben.test.ts` gegen den Editor-Stil.
- Tabellen lesen: `tabellenZeilen` in `shared/protokolle/dokument.ts` (eine Lesart für Lese-Ansicht, Suche, später PDF).
- `useThema` liegt jetzt in `ui/design/useThema.ts` (vorher nur im Protokoll-Editor).
