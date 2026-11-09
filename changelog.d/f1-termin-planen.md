### Neu (Dienstplaner)

- **Einteilen und senden direkt in der Termin-Ansicht.** Wer einen Dienst planen darf, tippt dort einen freien Platz an
  („Wer kann?“), zieht Einteilungen zurück oder ersetzt sie, öffnet Entwürfe und nutzt den Zauberstab je Gruppe – mit
  denselben Fenstern wie in „Planen“. Unten erscheint „Ansehen und senden“ für **nur diesen Termin**; liegen an anderen
  Terminen noch Entwürfe, sagt das Senden-Fenster, dass sie unter „Planen“ gesendet werden. So lässt sich ein einzelner
  Gottesdienst ganz in seiner Ansicht einteilen.

### Intern (Dienstplaner)

- Das Einteilen (Fenster, Leiste, Zauberstab, Entwurfs-Regeln) steht jetzt in `useEinteilen` statt in `Planen.tsx`, die
  Knopf-Regel der Plätze einmal in `EinteilPlaetze` (vorher zweimal in `PlanAnsicht`). Die Entwurfs-Attrappe der Tests
  liegt in `entwurfAnschluss.testutil.ts`.
