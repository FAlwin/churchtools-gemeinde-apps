### Intern (alle Apps)

- **Erinnerung für die README-Bilder:** Ein neuer CI-Ablauf (`readme-bilder.yml`) nimmt bei jedem PR, der eine App
  berührt, die Demo-Ansichten als Standbilder auf – mit und ohne den PR – und vergleicht sie mit kleiner Toleranz für
  Kantenglättung. Ändert der PR sichtbar etwas, bekommt er das Label „README-Bilder“; den PR bricht das nie ab.
  `npm run readme-bilder -- --offen` listet vor dem Release die gemergten PRs mit diesem Label seit dem letzten
  Bilder-Stand. In der Release-Routine (`CLAUDE.md`) steht, wann neu aufgenommen wird und was eine neue App braucht.
