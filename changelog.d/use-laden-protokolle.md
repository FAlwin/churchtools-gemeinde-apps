### Intern

- **`useLaden` auch in den Protokollen** (#845, Scheibe 3c): Vorlagen-Wahl, Anwesenheit, „Gruppe einrichten“,
  „Sitzung festlegen“, „Neues Protokoll“, „Sitzung bearbeiten“ und die Mitglieder beim Schreiben laden über den
  gemeinsamen Hook statt über sieben eigene Ladeblöcke. Was im Fenster geändert wird (Planung, Eingeladene, Stufen),
  liegt jetzt über dem Geladenen, statt es nach dem Laden umzukopieren. Neu im Hook: `setze` – was gerade geschrieben
  wurde und dessen Antwort den neuen Stand schon enthält, gilt sofort (Anwesenheit nach einem Tipp). Der Wächter gegen
  Ladeblöcke von Hand gilt jetzt auch für die Protokolle.
- Neue Tests für die Fehlerzweige, die bisher ungeprüft waren (Vorlagen, Sitzungen, Gruppe, Anwesenheit, Mitglieder,
  Termin), und für „Neues Protokoll“: Geändertes gilt beim Anlegen, eine andere Gruppe fängt mit ihrer Vorbelegung an.
