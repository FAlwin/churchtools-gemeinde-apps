### Intern (Protokolle)

- **Wackler in den To-Do-Tests behoben:** `ToDos.test.tsx` und `ToDos.board.test.tsx` zeigen die To-Do-Seite, deren
  Einstellungen sich über die echte Personen-Ablage mit ChurchTools abgleichen. Im Test scheiterte die Abfrage („fetch
  failed“) erst nach dem Testende, und das `console.warn` kam, während Vitest die Umgebung schon schloss –
  „EnvironmentTeardownError: Closing rpc while onUserConsoleLog was pending“ machte die CI rot, obwohl alle Tests grün
  waren (PR #836). Beide Tests gleichen jetzt ohne Netz ab (`protokolle/src/ohneAbgleich.testutil.ts`); je ein Test
  prüft, dass der Abgleich darüber läuft. Die App selbst ist unverändert.
