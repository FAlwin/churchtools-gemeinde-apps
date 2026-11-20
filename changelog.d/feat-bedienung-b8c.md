### Geändert (Musik-App)

- **Kopf wie in den anderen Erweiterungen.** Am iPad und Rechner steht über den Reitern klein der App-Name „Musik-App“ – so beginnt
  jede App gleich. Am Handy bleibt alles beim Alten (Reiter unten, die Seite beginnt gleich mit ihrem Kopf). „Mehr“ bleibt der letzte
  Reiter: Dort liegen die Einstellungen **und** die Ablaufvorlagen, Links, Team-Notizen und das Abmelden – es fällt nichts weg.
- **Ein Status-Etikett.** „Kein Ablauf“ (Termin, den man nicht anlegen darf), „Standard“ (Arrangement) und „nur ansehen“
  (Ablaufvorlagen eines fremden Kalenders) haben jetzt dieselbe Form wie in den anderen Apps: eine Kapsel, grau oder blau.

### Intern

- `ReiterLeiste` kennt `appName` (nur oben). Der Wächter `etiketten.test.ts` zählt jetzt auch die Musik-App (`client`: 9 Kapseln,
  alle Knöpfe oder Schalter: Zeichen-Leiste, Spendenknopf, Seitenwähler im Liedblatt).
