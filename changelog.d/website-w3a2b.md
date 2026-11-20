### Behoben (Website)

- **Die Vorschau der Website ist in ChurchTools jetzt gestaltet und lässt sich dort bearbeiten.** ChurchTools sperrt Stylesheets als `data:`-Adresse und Skripte ohne Erlaubnis – darum sah die Vorschau nach „Startseite anlegen“ ungestaltet aus, und die Leisten zum Bearbeiten fehlten. Das Stylesheet steht jetzt direkt im Vorschau-Dokument, und die Bearbeiten-Leiste trägt die Erlaubnis (Nonce) der ChurchTools-Seite.
- Läuft das Bearbeiten-Skript in der Vorschau trotzdem nicht, steht oben ein Hinweis („Bearbeiten in der Vorschau ist gerade nicht möglich …“) statt dass die Leisten still fehlen.
- Im Baustein-Fenster „Eigenes HTML“ steht dazu: Skripte darin laufen in der Vorschau in ChurchTools nicht, auf der Website schon.
