### Neu (Dienstplaner, E6-6a)

- **Der Ablauf in der Planen-Matrix:** Oben, über den Dienstgruppen, steht die Gruppe „Ablauf“ – je Termin „N Punkte“
  bzw. „kein Ablauf“, darunter der Ablauf in einer schmalen Form (Uhrzeit, Dauer, Titel; Lieder mit blauem Streifen,
  Überschriften und „Beginn“ als graue Balken – ohne Zuständige und Kürzel, dafür ist die Spalte zu schmal). Ein Lied
  antippen öffnet die Lied-Ansicht. Entwurf `e6-6-entwurf-2.html`, abgenommen von Alwin am 28.10.2026.
- **Ein Stift für alle gezeigten Termine** (Variante A): links in der Gruppenzeile, wo bei den Dienstgruppen der
  Zauberstab für alle Termine sitzt. Danach Griffe zum Ziehen innerhalb eines Termins, Zeile antippen öffnet das
  Punkt-Fenster, „+ Punkt“ am Ende, „+ Ablauf anlegen“ bei Terminen ohne Ablauf. Abgesagte Termine und solche, die man
  nicht bearbeiten darf, tragen ein Schloss. „Neu aufsetzen …“ bleibt in der Termin-Ansicht.
- **Zugeklappt merkt sich das Gerät** – lange Abläufe schieben die Dienste sonst weit nach unten (Alwin).
- **Am Handy** steht der Ablauf des gewählten Termins wie in der Termin-Ansicht (mit Zuständigen und Lied-Karte).

### Intern (E6-6a)

- Neu `dienstplaner/src/TerminAblauf.tsx`: der Ablauf eines Termins (Lieder nachladen, Ansicht, Bearbeiten-Liste,
  Lied-Ansicht, „Ablauf anlegen“/„Neu aufsetzen“, Neu-Lesen nach dem Speichern) – vorher fest in der Termin-Ansicht,
  jetzt dieselbe Stelle für die Termin-Ansicht und jede Spalte der Matrix. Matrix-Teil in `MatrixAblauf.tsx` und
  `useMatrixAblauf.ts` (lädt nur die gezeigten Termine, je Termin eine Abfrage; ein Ladefehler bleibt nicht hängen,
  „Erneut versuchen“).
- `ui/ablauf`: `AblaufListe`, `SortableRow` und `useAblaufBearbeiten` kennen `schmal` (ohne Zuständige/Kürzel/Notiz/
  Lied-Karte, Titel höchstens zwei Zeilen mit Silbentrennung; statt des schwebenden Plus „+ Punkt“ am Ende der Liste).
- Kalender und Admins eines Termins (Bearbeiten-Regel des Ablaufs) stehen an der Matrix-Spalte (`PlanSpalte.ablaufTermin`,
  dazu `beginn`), gelesen über `ablaufTerminVon` – vorher nur für den Einzeltermin; `TerminDaten.ablaufTermin` ist
  entfallen. `PlanenAnsicht.ablaufZu` neu.
- Der Hinweis-Stil der Termin-Ansicht liegt als Mixin in `_terminTexte.scss` (`composes … from` geht über SCSS-Dateien
  nicht).
