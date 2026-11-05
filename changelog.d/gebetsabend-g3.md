### Neu (Gebetsabend)

- **Übertragen aus der Seite (G3).** Wer zur Technik gehört, sieht über allem die Karte „Übertragung“: „Bild + Ton“
  oder „Nur Ton“ wählen, **„Übertragung starten“** – das setzt neue Zugangsdaten, startet den Sender direkt in der
  Seite (Kamerabild in der Karte) und meldet allen „läuft“. Nach dem Neuladen oder auf einem anderen Gerät startet der
  Sender nie von selbst; **„Sender hier starten“** macht mit denselben Daten weiter, die Zuhörer bleiben verbunden.
  Dazu **„Sender neu starten“** und **„Übertragung beenden“** (mit Rückfrage). Auf dem Gerät, das sendet, gibt es kein
  Zuhören – der Ton liefe sonst wieder ins Mikrofon. Unter dem **Zahnrad** stellt die Technik ein, aus welchem
  Kalender der nächste Termin kommt und an welchem Wort im Titel er erkannt wird.

### Intern (Gebetsabend)

- Zugang und Einstellungen liegen jetzt als **Dokument mit Versionsnummer** in ihrer Kategorie – über den gemeinsamen
  Baustein `@shared/ct/versionierterWert` (wie Plan und Sichtbarkeit im Organigramm), nicht nachgebaut
  (`shared/gebetsabend/ablage.ts`). Starten zwei Technik-Geräte zugleich, wird nichts still überschrieben; gestartet
  ist erst, was nachgelesen dasteht. Ein Eintrag aus G2 ohne Version (nur Test-Instanz) zählt als „nichts
  gespeichert“.
- Regeln der Technik ohne Oberfläche in `shared/gebetsabend/technik.ts` (Stand „aus / hier / woanders“, wann der
  Sender aufhört, Texte). Die Zustandszeile mit Punkt ist ein Baustein für Zuhören und Technik (`ZustandZeile`).
  Gegenprobe je Teil (12 Teile), Komponenten-Tests mit Fake-Timern.
