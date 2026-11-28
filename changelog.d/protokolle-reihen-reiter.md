### Neu (Protokolle)

- **Neuer Reiter „Reihen“** (zwischen „To-Dos“ und „Termine“): alle Reihen deiner Gruppen auf einen Blick, nach Gruppe geordnet – die nächste Reihe zuerst, danach die vergangenen. Jede Zeile zeigt den Zeitraum, die Zahl der Abende und „4 von 5 mit Event“ (grün, wenn jeder Abend ein Event hat). Ein Tipp öffnet dieselbe Karte wie im Protokoll mit **Bearbeiten** und **In Events übertragen**. Der Filter „Gruppe“ gibt es bei mehreren Gruppen.
- **„Neue Reihe“ auch ohne Protokoll:** Im Reiter legst du eine Reihe direkt an (am Handy mit dem grünen Plus). Bei mehreren Gruppen wählst du im Fenster die **Gruppe** – vorbelegt mit der Gruppe aus dem Filter. Hast du einmal auf „Speichern“ getippt, lässt sich die Gruppe nicht mehr ändern, damit auch nach einem Fehler nichts doppelt entsteht.
- Eine Reihe aus dem Reiter hängt an keinem Protokoll. In ein Protokoll lässt sie sich (noch) nicht holen: Der Baustein „Reihe“ legt dort immer eine neue an. Reihen lassen sich noch nicht löschen.

### Intern (Protokolle)

- Die Fenster der Reihe („Reihe“ bearbeiten/neu, „In Events übertragen“, frisches Lesen vor dem Öffnen) liegen jetzt an einer Stelle (`useReiheFenster`) und werden vom Protokoll und vom Reiter „Reihen“ gemeinsam genutzt. Neue reine Funktionen `reiheUeberblick`, `reihenOrdnen` und `reiheZeitraumText` in `shared/protokolle/themenreihe.ts`.
