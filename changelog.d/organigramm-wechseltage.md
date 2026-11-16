### Neu (Organigramm)

- **Organigramm: Unterreiter „Wechseltage“ im Reiter „Kinder & Jugend“** (Bauplan O9-4, nur Bereichsleitung und Admins).
  Die Seite zeigt je Jahr, das der Ferienkalender kennt, Sommerferien, Ankündigung, Wechseltag, Stichtag und ob die
  Regeln dafür in ChurchTools stehen („eingetragen“, „fehlt noch“, oder „nicht bekannt“, solange die Einrichtung es nicht
  weiß).
  - **Erinnerung, wenn die Wechseltage auslaufen:** Steht nur noch das Jahr des nächsten Wechsels in ChurchTools, erscheint
    gelb „Wechseltage fehlen bald“; fehlt es schon, „Ab … fehlen Wechseltage“. Derselbe Hinweis steht kurz in der
    Übersicht.
  - **Leitungen Bescheid geben:** Ab der Ankündigung steht ein fertiger Text bereit (Wechseltag, je Übergang die Zahl der
    Kinder, die wechseln – ohne Ausnahmen, dieselbe Zahl wie in der Übersicht) mit dem Knopf „Text kopieren“. Geht das
    Kopieren nicht, ist der Text markiert.
  - **Abgleich für Admins:** Die Regeln der Wechsel-Gruppen in ChurchTools werden gelesen und mit „eingetragen bis“
    verglichen; weicht ein Jahr ab, steht gelb, welche Gruppe und welches Jahr. Ein vorübergehender Fehler heißt „ließ
    sich gerade nicht prüfen“ – es wird nichts verändert.

### Intern (Organigramm)

- **Organigramm:** Die Einrichtung kennt das optionale Feld `eingetragenBis` (`gruppenwechselEinrichtung.ts`; fehlt es oder
  ist es ungültig, gilt es als nicht bekannt). Neu in `shared/organigramm/wechseltage.ts`: die Regel „läuft aus“
  (`wechseltageStand`), der Text für die Leitungen und der Abgleich (`regelAbweichungen`, gegen `kinderFenster` – den
  Baustein, aus dem `wechselGruppenRegeln` die Fenster baut); `wechslerZahl` zählt die Wechsler für die Übersicht und den
  Text. Das Kopieren steht jetzt in `ui/bedienung/useKopieren.ts` (vorher `useLinkKopieren` in den Anmeldungen) und
  fängt auch eine fehlende Zwischenablage ab.
