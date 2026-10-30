### Behoben (Musik-App)

- **Eigene Anmerkungen bleiben beim Umbenennen einer Version erhalten.** Ein neuer Versionsname ist intern ein neuer
  Schlüssel; Striche, Texte und Zoom lagen danach unter dem alten und waren auf jedem Gerät unsichtbar (gefunden beim
  Bau von #812). Jetzt gehen sie mit – kopiert, nicht verschoben, und über den normalen Upload-Weg auch aufs Konto.
  Eine **neu** angelegte Version bekommt weiterhin keine: Ihr Text ist ein anderer, die Striche säßen falsch.
  Grenze: Die Anmerkungen **anderer** Teammitglieder zu dieser Version liegen in deren Konto und bleiben beim alten
  Namen.

### Intern (Musik-App)

- `anmerkungenMitnehmen` in `services/annotations.ts` – welche Schlüssel dazugehören, entscheidet `versionKopien`
  (dieselbe Regel wie beim Schlüssel-Umzug vom 07.10.2026), nur der eigene Namensraum, Upload über `pushField`.
  Aufgerufen in `useChartEditor` beim Umbenennen, vor `selectVersion`.
