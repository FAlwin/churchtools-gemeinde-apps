### Intern

- **`useLaden` im Dienstplaner, Teil 1** (#845, Scheibe 3e-1): Startseite (Lieder, Abwesenheiten), Termin-Ansicht,
  Ablauf (Lieder, roter Live-Punkt), „Wer kann?“, Vorlieben, Dateien, „Meine Dienste teilen“, Senden-Fach, Tausch und
  die Entwürfe in „Planen“ laden über den gemeinsamen Hook statt über 14 eigene Ladeblöcke. Die Adresse der Musik-App
  holt jetzt **eine** Stelle (`useMusikApp`) statt dreier Ladeblöcke mit verschiedenem Umgang mit Fehlern. Neu im Hook:
  `setze((alt) => …)` ändert die geladenen Daten, auch mehrmals kurz hintereinander (einen Entwurf übernehmen, ohne
  alles neu zu laden). Der Zeitraum in „Planen“ und die Nachfrage zu fremden Terminen folgen in Teil 2, mit ihnen der
  Wächter gegen Ladeblöcke von Hand.
- Neue Tests: `useMusikApp`, die Warnung im Log bei „Meine Dienste“, Senden ohne prüfbare Hinweise, „Diesen Dienst
  hast du nicht mehr“ beim Tausch, ein Lesen der Vorlieben, das wirft.
