import { useLaden } from '@ui/ct/useLaden';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { KEINE_ANTWORTEN, type PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import type { AntwortenLader } from './ladeAntworten';

/** Vor die Meldung von `fehlerMeldung` – sonst wüsste man nicht, WAS gerade nicht geladen werden konnte. */
const VOR = 'Die Antworten aus „Verfügbarkeit“ konnten nicht geladen werden. ';

/**
 * **Die Antworten der Ansicht „Personen“** (E5c-3): geladen mit `useLaden` für die Dienstgruppen der gezeigten Dienste –
 * beim Öffnen und neu, sobald sich die Gruppen ändern (nicht der Zeitraum: die Antworten gelten je Termin, geladen ist
 * alles). Die bisherigen Antworten bleiben dabei stehen (`behalten`): ein Aussetzer beim Nachladen zerstört nichts, er steht
 * als `neuFehler` daneben. **Nie** wird ein Fehlschlag zu „keine Antworten“: Ohne Daten ist `antworten` leer, **nichts
 * sichtbar**, und `fehler` sagt warum.
 */
export function usePersonenAntworten(
  lader: AntwortenLader | undefined,
  dienstgruppenIds: readonly number[],
) {
  // Als einfacher Wert – ein neues Feld mit gleichem Inhalt lädt nicht neu. `lader` muss stabil sein (App: `useCallback`).
  const gruppen = dienstgruppenIds.join(',');
  const { stand, neu } = useLaden<PersonenAntworten>(
    () => (lader && gruppen !== '' ? lader(gruppen.split(',').map(Number)) : null),
    [lader, gruppen],
    { behalten: true },
  );
  const mit = (f: Fehlermeldung): Fehlermeldung => ({
    ...f,
    text: f.nochmal ? VOR + f.text : f.text,
  });
  const antworten = stand.art === 'fertig' ? stand.daten : KEINE_ANTWORTEN;
  return {
    antworten,
    /** Zum ersten Mal am Laden (noch keine Antworten). */
    laedt: stand.art === 'laedt',
    /** Gescheitert, und es gibt nichts Bisheriges (z. B. abgemeldet). */
    fehler: stand.art === 'fehler' ? mit(stand.fehler) : null,
    /** Das Neuladen ist gescheitert, die bisherigen Antworten stehen. */
    neuFehler: stand.art === 'fertig' && stand.neuFehler ? mit(stand.neuFehler) : null,
    neuLaden: neu,
  };
}
