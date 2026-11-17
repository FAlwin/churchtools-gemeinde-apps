### Neu (Dienstplaner)

- **Personen: bestehende Einteilungen per Klick bearbeiten.** Ein Klick auf eine zugesagte oder angefragte Einteilung – auch
  auf einen Gast in der Zeile „Gäste“ – öffnet dasselbe Fenster wie das Antippen eines belegten Platzes in der Matrix
  („Zurückziehen“, „Andere Person wählen“). Eine Einteilung, die ein Entwurf wegnimmt (zurückziehen oder ersetzen), steht
  wie in der Matrix rot gestrichelt und durchgestrichen da; ein Klick darauf öffnet den Entwurf, „Entfernen“ nimmt ihn zurück.
  „Andere Person wählen“ zeigt die neue Person als Entwurf in ihrer Zeile. Rechte wie in der Matrix; der Klick auf den Namen
  setzt weiter den Fokus.

### Intern (Dienstplaner)

- **Eine Regel „Platz wird weggenommen“ für das Aussehen** (`dienstplaner/src/_zurueck.scss`: Rahmen, Fläche, Symbol,
  Durchstreichen) – Matrix und „Personen“ nutzen sie gemeinsam. Neue Aktionen `belegt`/`entwurfFach` in `zellenAktion` und
  `gastAktion` (`personenEintragen.ts`); die Rechte der Klicks stehen an einer Stelle (`personenErlaubt` in `useEinteilen`).
