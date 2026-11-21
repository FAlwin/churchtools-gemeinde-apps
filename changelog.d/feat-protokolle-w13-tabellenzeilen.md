### Neu (Protokolle)

- **Unterzeile und „nur zur Info“ in Tabellen (W13).** Im Zeilenmenü der Tabelle (Griff links an der Zeile) stehen jetzt **„Nur zur Info“** und **„Als Unterzeile“**, jeweils
  mit Haken, wenn gesetzt – beide lassen sich verbinden. **Tab** am Anfang der ersten Zelle einer Zeile macht sie zur Unterzeile, **Umschalt+Tab** dort nimmt es wieder weg; überall
  sonst springt Tab wie bisher in die nächste Zelle (auch in einer leeren ersten Zelle, damit man durch eine neue Zeile kommt). Eine **Unterzeile** ist eingerückt, trägt „↳“ und eine
  gestrichelte Linie darüber – sie gehört zur Zeile darüber. Eine **Info-Zeile** trägt ein kleines ⓘ-Zeichen; unter der Tabelle steht dazu die Legende „nur zur Info – nicht Thema dieses
  Treffens“. Die Kennzeichen sind Text am Anfang der ersten Zelle („↳ “, „ⓘ “), darum bleiben sie beim Verschieben und Einfügen von Zeilen erhalten und brauchen kein neues
  Speicherformat. Die Regel steht in `shared/protokolle/tabellenZeile.ts`.
- **„Nur Themen dieses Treffens“ in der Lese-Ansicht (W13).** Enthält das Protokoll irgendwo eine Info-Zeile, steht über dem Protokoll ein Schalter, der alle Info-Zeilen samt ihren Unterzeilen ausblendet
  („2 Info-Zeilen ausgeblendet“ am Ende der Tabelle, die Legende fällt dann weg). Er gilt nur für die Anzeige – es wird nichts gespeichert, und das **PDF** zeigt immer alle Zeilen:
  Unterzeile eingerückt mit „↳“, Info mit ⓘ-Kreis, Legende darunter (beide Zeichen hat die PDF-Schrift nicht, sie werden gezeichnet). „Mit KI füllen“ ist nicht betroffen (Tabellen
  gehen nicht in den Auftrag).
