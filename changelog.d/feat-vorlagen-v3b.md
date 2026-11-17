### Neu (Musik-App)

- **Ablaufvorlagen ansehen und bearbeiten** (E10): Unter **Mehr** gibt es den Abschnitt **Abläufe** mit der Zeile
  **„Ablaufvorlagen“** – für alle, die Abläufe sehen dürfen. Sie öffnet dieselbe Seite wie im Dienstplaner: Vorlagen nach Kalender,
  „nur ansehen“ ohne das ChurchTools-Recht „Ablaufvorlagen bearbeiten“, mit dem Recht **anlegen**, füllen, **umbenennen** und – nach
  Nachfrage – **löschen**. **‹ Mehr** führt zurück, der Reiter „Mehr“ bleibt markiert. Es geht in der ChurchTools-Erweiterung
  **und** in der Server-Variante. Eine kurze Einführung erklärt die Seite beim ersten Öffnen (`vorlagen-v1`, `vorlage-v1`). Wer im
  Fenster „Ablauf anlegen“ eine Vorlage wählt, sieht gleich den neuen Stand (die Liste wird nach dem Schreiben neu geholt).

### Intern (Musik-App)

- **Server:** neue Routen `/api/ablauf-vorlagen/stand`, `/:vorlageId` (lesen, `PUT` umbenennen, `DELETE`), `POST /api/ablauf-vorlagen`
  und die Punkt-Routen unter `/api/ablauf-vorlagen/:vorlageId/agenda/…`. Die sechs Punkt-Handler und `ctWrite`-Funktionen
  nehmen ein `AblaufZiel` (Termin **oder** Vorlage) – **ein** Handler für beide Pfade statt einer Kopie (`zielAus`). Rechte
  entscheidet ChurchTools (403/412/423 gehen durch).
- **Browser-Zugriff geteilt:** `punktAktionen` und der Vorlagen-Zugriff des Dienstplaners liegen jetzt in
  `ui/ablauf/browserAblaufZugriff.ts`; die Musik-App-Erweiterung nutzt sie über die Weiche (`churchtoolsApi.ts`). Die Prüfung
  „ChurchTools hat Listen geliefert“ (`vorlagenStandAusRohdaten`) teilen sich Browser und Server.
