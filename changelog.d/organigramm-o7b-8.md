### Neu (Organigramm, O7b-8, #736)

- **Farbe in Diagrammen und Liste:** Vor jedem Gruppennamen steht die Kachel der Gruppe – Anfangsbuchstabe auf ihrer
  Farbe, wie in der Gruppenliste von ChurchTools (Wunsch Alwin 29.10.2026: „bunter … an den Gruppenansichten
  orientieren“; Entwurf `o7b-8-farbe-v1.html`, Variante „Kachel“). Gilt für Von oben, Von links, Mindmap, Liste, die
  Diagramme der Präsentation und die PDF. Die Farbe kommt wie bei den Karten aus der Gruppe, sonst aus ihrem Typ.

### Behoben (Organigramm)

- In der PDF saßen alle mittig gesetzten Texte im Diagramm (Namen, Rollen, Personen) zu hoch: Das Blatt wurde zum
  Messen der Grundlinie auf etwa 1 px verkleinert, der Browser rundete den Versatz dabei auf 0 (seit O7b-4; aufgefallen
  neben der Kachel). Gemessen wird jetzt am groß gezeichneten Blatt.

### Intern

- Die PDF übernimmt Rundungen, die per Stil kommen (`rx: var(--r-tile)`), damit die Kachel auch auf Papier rund ist
  und die Rundung nur an einer Stelle steht.
