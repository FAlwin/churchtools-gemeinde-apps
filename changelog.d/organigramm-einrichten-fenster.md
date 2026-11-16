### Neu (Organigramm)

- **Organigramm: Fenster „Gruppenwechsel einrichten“ und „Stufen ändern“** (Bauplan O9-5c-2, nur mit „Berechtigungen
  verwalten“). „Einrichten …“ auf der Seite „noch nicht eingerichtet“ und „Stufen ändern …“ unter der Karte „Stufen“ öffnen
  dasselbe Fenster mit zwei Schritten (Stufen › Vorschau › Fertig). **Es legt noch nichts in ChurchTools an und speichert
  nichts:** Der Hauptknopf ist aus („Schreiben kommt mit der nächsten Fassung“).
  - **Stufen:** Bereichsgruppe und Stufen (jüngste zuerst) mit der Gruppensuche, „ab N Jahren“, nach oben/unten/entfernen,
    „Stufe hinzufügen“; zugeklappt die weiteren Einstellungen (Stichtag, Ankündigung in Wochen, Aufnahme, Aufräumen,
    Ferienkalender mit „Sommerferien gefunden bis …“). Es geht nur weiter, wenn nichts fehlt; die Hinweise stehen am Feld.
  - **Vorschau:** „Wer wechselt wann wohin“ (Jahr × Übergang mit Zahlen, Namen zum Aufklappen, Hinweis auf Kinder ohne
    Geburtstag) und „Das legt die Erweiterung in ChurchTools an“ (je Baustein neu, vorhanden oder ändern). **Fremde Regeln
    in einer gewählten Gruppe oder Regeln, die sich nicht lesen ließen, sind ein Stopp** (roter Hinweis); beim Einrichten
    braucht es außerdem den Haken „Rechte der Leitung geprüft“.

### Geändert (Organigramm)

- **Organigramm: Die Bereichsgruppe darf keine Stufe sein, und jede Stufe braucht eine Gruppe.** Beides prüft das neue
  Fenster – und dieselbe Prüfung gilt beim Lesen der gespeicherten Einrichtung (eine solche Einrichtung gilt dann als nicht
  lesbar, wie bei jedem anderen Formatfehler).

### Intern (Organigramm)

- **Organigramm:** `einrichtungsPlan` (`shared/organigramm/einrichtungPlan.ts`) ist der Plan, den O9-5d ausführen wird: je
  Baustein `neu | vorhanden | ändern` und die geordnete Schrittliste in der Reihenfolge der Messung vom 16.11.2026. Was sich
  nicht lesen ließ, steht in `unsicher` und wird nie zu „fehlt“. Dazu `fremdeRegeln` (Stopp) und `darfSchreiben`.
  `fehlendeLeiterRechte` und `routineBefund` sind aus dem Stand-Abgleich herausgezogen (eine Stelle für Zeile und Plan),
  `regelnLesen` aus dem Lader; `einstellungFehlerJeFeld` ordnet jeden Fehler einem Feld zu.
- **Organigramm:** `SpitzenAuswahl` nimmt optional einen eigenen Namen für „nichts gewählt“ (`leerName`) – so wählt das neue
  Fenster EINE Gruppe mit derselben Suche wie „Anfangen bei“.
- **Organigramm (Demo):** `?demo=neu` zeigt „noch nicht eingerichtet“, `?demo=fremd` eine Stufe mit fremder Regel; die Stufen
  der Demo haben jetzt Kinder mit Geburtstagen.
