### Geändert (Protokolle, S2-4)

- **„Deine Gruppen“ zeigt nur noch Gruppen, deren Protokolle man sehen darf** (Alwin, 22.10.2026). Vorher sah ein
  Mitglied ohne Zugriff seine eingerichtete Gruppe als „nicht eingerichtet“ – die Erweiterung kann die beiden Fälle
  nicht unterscheiden. Darunter steht jetzt immer: „Fehlt eine Gruppe? Ein Admin richtet sie ein oder gibt dir
  Zugriff.“ Den Stand aller Gruppen sehen Admins in der Verwaltung.
- Prüfung mit drei Rollen in der Test-Instanz (Admin, Leitung, Mitglied per „Benutzer simulieren“, dazu „Kein
  Zugriff“ und versteckte Gruppe), jeweils über die Schnittstelle gegengeprüft: Ein Mitglied ohne Recht liest das
  Protokoll nicht (401), Herabstufen wirkt sofort, „versteckte Gruppe sehen“ kommt und geht mit dem Zugriff.
  Anleitung `docs/betrieb/PROTOKOLLE.md` auf Stand S2 gebracht.
