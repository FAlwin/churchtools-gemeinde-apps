### Neu (Protokolle, S7-1)

- **Reiter „To-Dos“** (Alwin 30.10.2026, Entwurf `s7-todos-v2.html`): alle To-Dos der eigenen Gruppen in einer Liste,
  **nach Status oder nach Person** eingeteilt (im Gerät gemerkt). Die Leitung sieht alle To-Dos ihrer Gruppen,
  Mitglieder ihre eigenen und die, für die noch niemand zuständig ist. Der Status steht als **Marke mit Zeichen und
  Wort** („◐ In Arbeit“) und schaltet mit einem Tipp weiter – abhaken, ohne ins Protokoll zu springen, auch bei schon
  freigegebenen Protokollen. Filter für Gruppen und Zuständige; Erledigte älter als 30 Tage per Schalter. Ein Tipp auf
  den Text öffnet das Protokoll, aus dem das To-Do stammt.
- **Startseite:** „Alle anzeigen“ an „Meine offenen To-Dos“ öffnet den Reiter.

### Intern

- „Im Gerät merken“ (`leseImGeraet`/`merkeImGeraet`) liegt jetzt in `ui/bedienung/geraet.ts` statt nur im Dienstplaner.
- Ältere Erledigte sind bewusst **kein** Filter: Sonst stünde am Filter-Knopf ab Werk eine „1“.
