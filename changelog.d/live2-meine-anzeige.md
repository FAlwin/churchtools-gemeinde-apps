### Neu (Dienstplaner)

- **„Meine Anzeige“** (Live-Ansicht 2, L4-5): Im Reiter „Einstellungen“ stellt jede Person für sich ein, was sie sehen will – **„−1 / +1 Min“ in der Live-Ansicht**, **Durchschnitt beim Ablauf bearbeiten**, **Rückblick im Termin** (mit den Spalten „Ø bisher“ und „±“) und **Infos meiner Dienstgruppen in der Live-Ansicht**. Alles ist zunächst an. Es gilt für dich auf allen deinen Geräten (gespeichert in einer Datei an deinem ChurchTools-Konto); die Betriebsart oben ändern weiterhin nur Planer. Antwortet ChurchTools nicht, bleibt deine Auswahl auf dem Gerät und wird nachgeholt – es geht nichts verloren.
- **Knopf „Live“ auf der Startseite:** In „Als Nächstes“ führt er am Tag des Termins (ab 0 Uhr bis zum Ende) direkt in die Live-Ansicht. Läuft die Live-Agenda gerade, trägt er den roten Punkt; am Handy steht das Wort „Live“ neben „Ablauf & Dienste“.

### Intern (Dienstplaner + Protokolle)

- Der Abgleich der Einstellungen je Person (Gerät ↔ Personen-Datei in ChurchTools, nie mit Standardwerten überschreiben) liegt jetzt in `ui/ct/useAblageSpiegel.ts`; die To-Do-Einstellungen der Protokolle nutzen denselben Baustein statt einer eigenen Kopie.
