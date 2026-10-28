### Intern (Protokolle)

- **Wackelnder Test, zweiter Anlauf:** `abschnittZiehen.test.ts` (S4-3b) hängte echte Editoren ein und nie wieder aus –
  dieselbe Ursache wie bei `editorSchema.test.tsx` (26.10.2026); die CI scheiterte am 28.10.2026 wieder mit „document
  is not defined“. Der Helfer zum Aushängen stand nur in der einen Testdatei. Jetzt liegt er an einer Stelle,
  `protokolle/src/editorTest.testutil.ts`: `einhaengen(editor)` hängt den Editor ein und nach dem Test von selbst
  wieder aus. Beide Testdateien nutzen ihn.
- **Dauerprüfung** `ui/design/editorEinhaengen.test.ts`: Kein Test und keine Test-Hilfe in den Apps, `ui/` und
  `shared/` darf `.mount(` selbst aufrufen, nur der Helfer. Ein neuer Test prüft außerdem, dass das Aushängen ohne
  eigenes `afterEach` passiert.
