### Behoben (Musik-App)

- **Geteiltes Gerät in der Erweiterung:** Meldete sich nach A jemand anderes in ChurchTools an (oder wurde eine Person
  simuliert), lag alles von A noch im Browser – die Erweiterung hat kein eigenes Abmelden. Was A ohne Netz geändert
  und nicht mehr hochgeladen hatte (Tonart, Kapo, Striche), landete dann **auf Bs Konto**, und bis zum Abgleich sah B
  As Werte und zwischengespeicherte Abläufe. Jetzt merkt sich das Gerät, für wen es zuletzt lief; wechselt die Person,
  wird es zuerst geräumt wie beim Abmelden der Server-App (`clearDeviceData`). Hochgeladen wird erst, wenn feststeht,
  wer angemeldet ist. Wie beim Abmelden gilt: Was A noch nicht hochgeladen hatte, ist dann weg statt bei B.
