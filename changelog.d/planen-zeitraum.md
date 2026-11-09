### Intern

- **„Planen“: Zeitraum und Fenster als Hook** (#845, Schritt 4, Scheibe 4a-3): `usePlanZeitraum` trägt, welcher
  Zeitraum gilt (je Unteransicht), was dafür geladen ist (leise bei ＋ und nach dem Senden), welcher Ausschnitt zu
  sehen ist (‹ ›, Nachladen am Ende von „ab heute“) und was der Zeitraum-Knopf dazu sagt. Unverändert übernommen;
  `Planen.tsx` hat statt 909 noch rund 790 Zeilen (vor Schritt 4: 2.010). Neuer Test: Am Handy zählt der Zeitraum-Knopf
  alle geladenen Termine – dieselben teilt „Plan teilen“.
