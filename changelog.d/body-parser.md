### Behoben (Musik-App)

- **Der Server lässt sich nicht mehr ohne Anmeldung mit großen Anfragen lahmlegen** (#844). Bisher las er jeden
  Rumpf bis 8 MB, bevor das Rate-Limit zählte – auch beim Login. Jetzt zählt er zuerst und weist eine Anfrage über dem
  Kontingent ab, ohne sie zu lesen. Die Grenze liegt bei 1 MB, nur Anmerkungen und Einstellungen dürfen bis 8 MB
  groß sein. `body-parser` ist auf 2.4.0 angehoben (Lücke GHSA-27r3-jxmh-p828), dazu `dompurify` und `qs`.
- Eine zu große Anfrage bekommt **413 „Die Daten sind zu groß.“**, kaputtes JSON **400** – vorher wurde aus beidem
  ein 500 „Interner Serverfehler“ mit Stacktrace im Log.
