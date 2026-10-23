### Behoben (Dienstplaner)

- **Weitere Termine laden, wenn es scheitert:** Im ersten Bild mit „Erneut versuchen“ stand der Knopf noch auf „wird
  geladen …“ und gesperrt – in „Planen“ das ＋ samt „weitere Termine werden geladen …“, in „Termine“ „Weitere Termine
  laden“. Ein Effekt räumte den Ladezustand erst ein Bild später weg. Jetzt ist er mit der Antwort (oder dem Fehler)
  schon in diesem Bild vorbei. Gefunden, weil ein Test genau dieses eine Bild unter Last mal sah und mal nicht; die
  Tests prüfen es jetzt in jedem Commit (React-`Profiler`) und sind damit nicht mehr vom Zufall abhängig.
