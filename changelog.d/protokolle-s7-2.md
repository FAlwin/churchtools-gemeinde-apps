### Neu (Protokolle, S7-2a)

- **Fenster „To-Do“** (Alwin 30.10.2026): Ein Tipp auf ein To-Do im Reiter „To-Dos“ öffnet es – Text, Gruppe, Bis,
  Status, Zuständige (auch niemand oder jemand außerhalb der Gruppe), neue Notiz, Verlauf und Löschen (nur vermerkt).
  Gespeichert wird nur, was geändert wurde – hat inzwischen jemand anderes abgehakt, bleibt das.
- **„Auf Karte anzeigen“**: je ein Schalter bei „Notizen“ und „Aus welcher Sitzung“ – dann zeigt die Karte die letzte
  Notiz bzw. die Sitzung (mit Sprung ins Protokoll). Für alle gespeichert.
- **„Neues To-Do“** ohne Protokoll, für Leitung und Mitglieder; ohne Zuständige ist es ein To-Do der Gruppe.
- **Gruppe wechseln** verschiebt das To-Do (neu in der anderen Gruppe, das alte als gelöscht vermerkt).
- To-Dos aus einem **Protokoll-Entwurf**: Text, Gruppe und Löschen ändern sich dort (das Nachziehen aus dem Fenster
  folgt mit S7-2b).

### Intern

- Ein Schreibweg für To-Dos aus der Übersicht (`protokolle/src/todoSchreiben.ts`) – auch die Status-Marke nutzt ihn.
- Verschieben legt erst an (nachgelesen), dann wird das alte vermerkt; scheitert das Zweite, steht es doppelt statt
  nirgends, mit Hinweis.
- Hover-Farben der To-Do-Übersicht (Status-Marke, Karten, Links) nur mit Maus – S7-1 kam nach dem Wächter aus #776 auf
  `main` und hatte drei ungeschützte Regeln; der Wächter `ui/design/hoverNurMaus.test.ts` war dort deshalb rot.
