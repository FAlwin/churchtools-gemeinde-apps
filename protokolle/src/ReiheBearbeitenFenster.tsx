import { useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import type { Person } from '@shared/organigramm/mitglieder';
import type { Themenreihe } from '@shared/protokolle/themenreihe';
import { ladeGruppenMitglieder } from './mitglieder';
import type { MitarbeitOrt } from './mitarbeitWerte';
import { ReiheFenster } from './ReiheFenster';
import type { ReiheFensterArt } from './useReiheFenster';

/**
 * Das Fenster „Reihe“ mit den Mitgliedern der Gruppe (für „Wer“) – erst gelesen, wenn das Fenster aufgeht. **Die gewählte
 * Gruppe liegt hier, nicht im Fenster:** Ein Wechsel baut das Fenster nicht neu auf (die Eingaben bleiben), nur Ort und
 * Mitglieder folgen der Gruppe.
 */
export function ReiheBearbeitenFenster(p: {
  f: Extract<ReiheFensterArt, { art: 'bearbeiten' }>;
  ortVon: (gruppe: number) => MitarbeitOrt | null;
  ich: { person: number };
  /** Kalender mit „Termine anlegen“ und „Events anlegen“ – für „Event neu anlegen“ im Fenster. */
  eventAnlegen: readonly number[];
  onGespeichert: (r: Themenreihe) => void;
  onClose: () => void;
}) {
  const [gruppe, setGruppe] = useState(p.f.gruppe);
  const ort = p.ortVon(gruppe);
  const stand = useLaden(() => ladeGruppenMitglieder(gruppe), [gruppe]).stand;
  const mitglieder: readonly Person[] | 'verborgen' | null =
    stand.art === 'fertig' ? stand.daten : stand.art === 'fehler' ? 'verborgen' : null;
  if (!ort) return null;
  return (
    <ReiheFenster
      reihe={p.f.reihe}
      neu={p.f.neu}
      mitglieder={mitglieder}
      ort={ort}
      ich={p.ich}
      gruppenwahl={
        p.f.gruppenwahl
          ? { gruppen: p.f.gruppenwahl, gewaehlt: gruppe, onWahl: setGruppe }
          : undefined
      }
      eventAnlegen={p.eventAnlegen}
      onGespeichert={p.onGespeichert}
      onClose={p.onClose}
    />
  );
}
