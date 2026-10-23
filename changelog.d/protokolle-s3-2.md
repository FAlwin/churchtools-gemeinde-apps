### Neu (Protokolle, S3-2)

- **Reiter „Sitzungen“** (Entwurf 7): je Gruppe **Kommend** (Termine mit Besprechungsanfrage, Gruppentreffen,
  begonnene Protokolle) und **Protokolle** (freigegeben, neueste zuerst), bei mehreren Gruppen oben umschaltbar.
  Hinweise, wenn kein Kalender gewählt ist oder ChurchTools die Gruppentreffen nicht zeigt.
- **Eine Sitzung ansehen:** das Protokoll als Dokument in einer **eigenen, schlanken Darstellung** (Alwin,
  23.10.2026) – nummerierte Tagesordnungspunkte, Formatierung, verschachtelte Listen, Zitate, Links (nur Web- und
  Mail-Adressen), Aufgaben mit Stand und Frist aus „Mitarbeit“, Beschlüsse, Termine; unbekannte Blöcke zeigen ihren
  Text. Darunter die Bereiche **Beschlüsse · To-Dos · Termine** aus derselben Ableitung wie das Dokument. Ist ein
  Protokoll gerade nicht vollständig lesbar, steht das da statt eines halben Dokuments.

### Geändert (gemeinsam)

- **Listen in ChurchTools mit Punkten und Nummern:** ChurchTools (Tailwind) nimmt `ul`/`ol` ihre Zeichen – im
  Protokoll fehlten so die Aufzählungszeichen (nur in ChurchTools sichtbar, nicht in der Demo). Die Regel steht jetzt
  einmal als `listenMitZeichen` in `ui/design/_mixins.scss`; die zwei Einzelstellen der Anmeldungen nutzen sie mit.
  Die Hauptknöpfe der Protokolle-Fenster nutzen den vorhandenen `hauptKnopfBreit` statt einer eigenen Kopie.
