### Neu (Protokolle)

- **Rechte im To-Do (W9a):** Mitglieder (wer in der Gruppe keine Protokolle schreibt) bearbeiten nur noch, was zu ihrem
  To-Do passt – die Leitung darf wie bisher alles.
  - **Eigenes To-Do** (nur ich bin zuständig): abhaken, „in Arbeit“, Notiz, Frist, **an ein anderes Mitglied abgeben**
    („Abgeben an“ im Fenster), Text ändern und löschen. Steht es noch in einem Protokoll-Entwurf, bleiben Text und Löschen
    bei der Leitung – das Fenster sagt es.
  - **Geteiltes To-Do** (mehrere Zuständige oder „Alle“): nur abhaken (bei „Jeder für sich“ den eigenen Teil) und Notizen.
  - **To-Do ohne Zuständigen:** statt des Hakens der Knopf **„Das mache ich“** (an Karte, Tabellenzeile und im Fenster) –
    er trägt nur mich ein, danach ist es mein eigenes To-Do.
  - **Fenster:** Was man nicht ändern darf, steht als normaler Text (Beschriftung und Wert), nicht als ausgegrautes Feld;
    ein Satz mit Schloss sagt, wer den Rest ändert. Kein „Löschen“, wo es nicht erlaubt ist.
  - **„Neues To-Do“ als Mitglied:** vorerst nur für sich selbst (Zuständig steht fest).
  - **Im Board** lässt sich nur noch ziehen, was man auch im Fenster ändern dürfte; sonst steht ein Hinweis da.
  - Die Regel steht an **einer** Stelle (`toDoRechte` in `shared/protokolle/aufgaben.ts`) und gilt **auch beim Speichern**
    (`toDoAendern`, `toDoAnlegen`, `toDoLoeschen`, `toDoVerschieben` prüfen am frisch gelesenen Stand) – nicht nur in der
    Oberfläche. ChurchTools selbst kennt dafür kein Recht.
