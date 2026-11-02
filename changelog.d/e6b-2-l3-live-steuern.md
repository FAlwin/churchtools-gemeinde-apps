### Neu (Dienstplaner, E6b-2 L3 – Alwin, 02.11.2026)

- **„Live“ steuern:** Wer an einem Termin in einem Dienst mit „Live-Agenda steuern“ eingeteilt ist (genau die Regel
  von ChurchTools), bekommt in „Live“ unter dem Kreis **‹ Zurück**, **Weiter ›**, **− 1 Min** und **+ 1 Min** – vor
  dem Start nur **Starten**. Geschaltet wird im Live-Stand von ChurchTools: Die Live-Agenda dort und alle anderen
  Geräte folgen, und umgekehrt.
  - „Weiter“ und „Zurück“ überspringen Lieder ohne Dauer (wie ChurchTools) und weggelassene Punkte. ±1 Min ändert die
    Restzeit, der Punkt bleibt. Am Ende ist „Weiter“ gesperrt.
  - Der neue Stand steht sofort da; eine ältere Abfrage, die noch unterwegs war, überschreibt ihn nicht.
  - Vor jedem Schalten wird der Ablauf frisch gelesen. Hat ihn jemand geändert (Punkt davor gelöscht), wird die Stelle
    erst nachgezogen – sonst schaltete man vom falschen Punkt aus weiter.
  - Klappt das Schalten nicht, steht es daneben („Nicht übernommen – vermutlich hat gerade jemand anderes geschaltet.“
    bzw. „Nicht gespeichert – … Bitte noch einmal tippen.“).
  - Am Handy vier Symbolknöpfe ‹ › − + wie in der Live-Agenda von ChurchTools. Testfall TF-ABLAUF-15.

### Intern (Dienstplaner)

- `PlanSpalte.liveSteuern` aus `darfLiveSteuern` (eine Stelle in `planAus`); in der Demo darf „Ton“ steuern.
