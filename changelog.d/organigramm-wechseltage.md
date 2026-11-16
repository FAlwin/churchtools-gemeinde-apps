### Neu (Organigramm)

- **Organigramm: Unterreiter „Wechseltage“ im Reiter „Kinder & Jugend“** (Bauplan O9-4, Bereichsleitung und Admins).
  Die Seite zeigt je Jahr, das der Ferienkalender kennt, Sommerferien, Ankündigung, Wechseltag und Stichtag.
  - **Wer „Berechtigungen verwalten“ hat, sieht zusätzlich, welche Wechseltage in den Regeln von ChurchTools stehen**
    („eingetragen“, „unvollständig – fehlt bei …“, „fehlt noch“, „nicht prüfbar“). Die Erweiterung liest die Regeln der
    Wechsel-Gruppen selbst – es gibt kein eigenes Merkfeld daneben. Die Bereichsleitung ohne dieses Recht sieht Ferien und
    Wechseltage, aber keine Spalte und keine Erinnerung.
  - **Erinnerung, wenn die Regeln auslaufen** (Seite und Übersicht, nur mit dem Recht): „Wechseltage fehlen bald. Die
    Regeln reichen nur noch bis …“ bzw. „Ab … fehlen Wechseltage in den Regeln.“ Lassen sich die Regeln nicht lesen,
    steht „nicht prüfbar“ – keine Erinnerung, nichts wird verändert.
  - **Leitungen Bescheid geben:** Ab der Ankündigung steht ein fertiger Text bereit (Wechseltag, je Übergang die Zahl der
    Kinder, die wechseln – ohne Ausnahmen, dieselbe Zahl wie in der Übersicht) mit dem Knopf „Text kopieren“. Geht das
    Kopieren nicht, ist der Text markiert.

### Intern (Organigramm)

- **Organigramm:** `OrgRechte.rechteVerwalten` (churchcore: administer persons, gelesen über `rechteAus` wie in
  Musik-App und Dienstplaner – nicht `gruppenVerwalten`). Neu in `shared/organigramm/wechseltage.ts`: `jahrStaende`
  (gegen `kinderFenster`, den Baustein, aus dem `wechselGruppenRegeln` die Fenster baut), `regelnReichenBis`, die Regel
  „läuft aus“ (`wechseltageStand`) und der Text für die Leitungen; `wechslerZahl` zählt die Wechsler für die Übersicht
  und den Text. `ladeRegelStand` liest `GET /dynamicgroups/{id}/ruleset`: 404 heißt „keine Regeln“, 401/403/Netz/5xx
  „nicht prüfbar“ (401 ist dort fehlendes Recht, kein Abmelden). Das Kopieren steht jetzt in
  `ui/bedienung/useKopieren.ts` (vorher `useLinkKopieren` in den Anmeldungen) und fängt auch eine fehlende
  Zwischenablage ab.
