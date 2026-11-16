import { useCallback, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import type { PersonenLader } from './ladePersonen';

const NICHTS: PersonenDaten = new Map();

/**
 * **Die Daten der Ansicht „Personen“** (Wunsch 5, P1): Mitglieder und Abwesenheiten der CT-Gruppen, geladen mit
 * `useLaden` – beim Öffnen und neu, sobald sich Gruppen oder Zeitraum ändern. Die bisherigen Daten bleiben dabei stehen
 * (`behalten`): ein Aussetzer beim Nachladen zerstört nichts.
 *
 * `nochmal(ids)` wiederholt **nur die gescheiterten Gruppen** und führt das Ergebnis in den Bestand ein – der Rest bleibt.
 * Scheitert auch das, steht der Fehler wieder an diesen Gruppen (bei 401 ohne „Nochmal“, die Meldung sagt es).
 */
export function usePersonenDaten(
  lader: PersonenLader | undefined,
  gruppenIds: readonly number[],
  zeitraum: { von: string; bis: string } | null,
) {
  // Gruppen und Zeitraum als einfache Werte – ein neues Feld mit gleichem Inhalt lädt nicht neu. `lader` muss stabil sein
  // (App: `useCallback`).
  const gruppen = gruppenIds.join(',');
  const von = zeitraum?.von;
  const bis = zeitraum?.bis;
  const { stand, neu, setze } = useLaden<PersonenDaten>(
    () =>
      lader && von && bis && gruppen !== ''
        ? lader(gruppen.split(',').map(Number), von, bis)
        : null,
    [lader, gruppen, von, bis],
    { behalten: true },
  );
  const [ladend, setLadend] = useState<ReadonlySet<number>>(new Set());

  const nochmal = useCallback(
    async (ids: readonly number[]) => {
      if (!lader || !zeitraum) return;
      setLadend((alt) => new Set([...alt, ...ids]));
      let neuerStand: Map<number, GruppenStand>;
      try {
        neuerStand = new Map(await lader(ids, zeitraum.von, zeitraum.bis));
      } catch (e) {
        const f = fehlerMeldung(e);
        neuerStand = new Map(
          ids.map((id): [number, GruppenStand] => [id, { art: 'fehler', ...f }]),
        );
      }
      setze((alt) => new Map([...alt, ...neuerStand]));
      setLadend((alt) => new Set([...alt].filter((id) => !ids.includes(id))));
    },
    [lader, zeitraum, setze],
  );

  const daten: PersonenDaten = stand.art === 'fertig' ? stand.daten : NICHTS;
  const fehler: Fehlermeldung | null = stand.art === 'fehler' ? stand.fehler : null;
  return {
    daten,
    /** Zum ersten Mal am Laden (noch keine Daten). */
    laedt: stand.art === 'laedt',
    /** Alles gescheitert (z. B. abgemeldet) – nur dann ohne Daten. */
    fehler,
    /** Das Neuladen ist gescheitert, der bisherige Stand steht. */
    neuFehler: stand.art === 'fertig' ? (stand.neuFehler ?? null) : null,
    neuLaden: neu,
    nochmal,
    ladend,
  };
}
