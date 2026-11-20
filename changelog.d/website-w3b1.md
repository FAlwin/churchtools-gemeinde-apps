### Neu (Website)

- **Rechte beim Einrichten (W3b-1):** Beim Einrichten wählt ein Admin **je Rolle der Gruppe „Website“** die Stufe – **Kein Zugriff,
  Redakteur oder Leitung** (vorbelegt: Rollen mit Leiter-Kennzeichen = Leitung, alle anderen = Redakteur). Die Erweiterung setzt die
  Rechte in ChurchTools selbst und liest nach, ob sie übernommen wurden. **Redakteure** bearbeiten die Entwürfe und dürfen
  „Veröffentlicht“ nur lesen; die **Leitung** darf zusätzlich in „Veröffentlicht“ schreiben. Entzogen wird nur, was auf die beiden
  Kategorien der Website zeigt – von Hand gesetzte Rechte anderswo bleiben.
- **„Wer darf was“ im Fenster „Einstellungen“:** Dieselbe Liste später noch einmal, mit „Rechte setzen“. Die Stufe wird **nicht
  zusätzlich gespeichert**, sondern aus den Rechten in ChurchTools abgeleitet; Rechte, die von Hand verändert wurden, zeigt die Liste
  als „Weicht ab“. Sehen und setzen darf das nur, wer in ChurchTools „Personen administrieren“ hat.
- **Hinweis beim Start (nur für diese Admins):** Haben die Rollen keine oder abweichende Rechte, steht oben ein ruhiger Hinweis mit
  dem Weg zu „Wer darf was“.
- **Redakteure in der Oberfläche:** Reiter „Seiten“ und „Freigaben“; **kein** Aussehen, **keine** Einstellungen, kein Menü in „Seite
  einstellen“ (Menütitel ziehen dem Seitentitel weiter nach) und kein Baustein „Eigenes HTML“. Einreichen und Freigeben folgen mit
  W3b-2.

### Geändert (Website)

- **Zugang aus den eigenen Rechten:** Wer die Website bearbeiten darf, ergibt sich jetzt aus den **Rechten der Person an den
  Kategorien** (Schreiben in „Entwürfe“ und „Veröffentlicht“ = Leitung, nur „Entwürfe“ = Redakteur) – nicht mehr daraus, ob sie die
  Gruppe leitet. Vorher bekam eine Leitung ohne Rechte den Editor gezeigt, und Speichern scheiterte. Leitet jemand die Gruppe, hat
  aber noch keine Rechte, sagt der Hinweis, dass ein Admin sie unter Einstellungen → „Wer darf was“ einrichtet. **Für bestehende
  Einrichtungen:** Die von Hand gesetzten Rechte genügen weiter; wer Redakteure oder weitere Rollen will, setzt sie in „Wer darf was“.

### Intern (alle Apps)

- **Rechte an Gruppenrollen als gemeinsamer Baustein:** Lesen, Rechte-Nummern aus den Definitionen, Soll gegen Ist, Entziehen,
  Nachschieben und Nachlesen stehen in `shared/ct/rollenRechte.ts` (aus den Protokollen gehoben) – Protokolle und Website nutzen
  denselben Ablauf. Das Verhalten der Protokolle bleibt gleich, ihre Tests sind unverändert grün.
