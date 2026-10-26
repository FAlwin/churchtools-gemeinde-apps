### Intern (Protokolle)

- **Wackelnder Test behoben:** `editorSchema.test.tsx` hängte zwei echte Editoren ein und nie wieder aus. Ein später
  Zeitgeber von ProseMirror (20 ms) fasste dann nach dem Abbau von jsdom `document` an – die CI scheiterte mit
  „document is not defined“, obwohl alle Tests grün waren (26.10.2026). Jetzt werden eingehängte Editoren nach jedem
  Test ausgehängt (und damit zerstört); ein eigener Test prüft, dass ein ausgehängter Editor `document` nicht mehr
  anfasst.
