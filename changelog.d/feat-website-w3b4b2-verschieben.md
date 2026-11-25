### Geändert (Website)

- **Bereich ändern verschiebt sofort (W3b-4b-2):** Stellt die Leitung der Website in **Seite einstellen → Bereich** eine Seite um,
  die schon online steht, wandert die veröffentlichte Fassung gleich nach dem Speichern in den neuen Bereich – nur ihr Bereich ändert
  sich, ungeprüfte Änderungen im Entwurf gehen dabei nicht online. Bisher blieb sie bis zum nächsten Freigeben im alten Bereich; gab
  dann die Leitung der Untergruppe frei, stand die Seite doppelt online. Klappt das Verschieben gerade nicht, ist der Bereich trotzdem
  gespeichert, und die Meldung sagt, dass die Seite online vorerst noch im alten Bereich steht („Veröffentlichen“ verschiebt sie).

### Intern (Website)

- `bereichWechseln` in `shared/website/freigabe.ts`; `gibFrei` und der Bereichswechsel teilen sich den Ablauf „schreiben → nachlesen →
  alt löschen“ (`inBereichSchreiben`). `bereichSetzen` in `zugang.ts` ist die eine Regel für das Feld `bereich` (Entwurf, neue Seite,
  Online-Fassung) – die Prüfsumme hängt an der Reihenfolge der Felder.
- Regel für den Bau-Dienst (W5) in `docs/betrieb/WEBSITE.md`: Steht eine Seite in mehreren Veröffentlicht-Kategorien, gilt nur die
  jüngste Kopie.
