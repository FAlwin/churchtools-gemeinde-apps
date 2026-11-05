### Behoben (Musik-App)

- **Andere Seiten unter derselben Domain können nichts mehr in der Musik-App ändern** (#849). Das Sitzungs-Cookie
  (`SameSite=Lax`) schützt nur vor fremden Domains; eine Seite wie die Gemeinde-Website oder das Anmeldeformular hätte
  im Namen einer angemeldeten Person schreiben können. Jetzt lehnt der Server schreibende Anfragen ab, die laut Browser
  nicht aus der App selbst kommen.

### Behoben (Dienstplaner)

- **Dateien in der Lied-Ansicht öffnen nur noch sichere Adressen** (#849). Eine `javascript:`-Adresse aus ChurchTools
  wurde vorher als Link gezeigt; ChurchTools lehnt sie beim Anlegen zwar ab, über die API oder aus älteren Einträgen
  kann sie trotzdem dastehen.

### Behoben (Anmeldungen)

- **Das Logo im Formular kommt nur noch aus der eigenen ChurchTools-Instanz** (#849). Die Adresse steht in der Gruppe;
  eine fremde Adresse hätte einem fremden Server verraten, wer das Formular öffnet.

### Intern (alle Apps)

- Eine Prüfung für Adressen aus Daten: `sichererLink`/`adresseInInstanz` in `shared/ct/sichereAdresse.ts` statt drei
  eigener (Protokolle, Termin-Dateien, Links der Musik-App). ESLint sperrt geschriebene `javascript:`-Adressen in
  `href`/`src`. Der frühere Platzhalter `hier-langen-zufallsstring-eintragen` gilt nicht mehr als Sitzungs-Geheimnis.
  `.gitignore` fängt `*.local.js`, `fotos.local/`, `rohdaten.local/` ab.
