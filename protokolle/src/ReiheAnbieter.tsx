import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Person } from '@shared/organigramm/mitglieder';
import { themenreiheIds, type Block } from '@shared/protokolle/dokument';
import { neueThemenreihe, neueZeile, type Themenreihe } from '@shared/protokolle/themenreihe';
import { darfSchreibenIn } from '@shared/protokolle/zugang';
import { ladeGruppenMitglieder } from './mitglieder';
import { ReiheFenster } from './ReiheFenster';
import { ReiheUebertragenFenster } from './ReiheUebertragenFenster';
import { ladeThemenreihen } from './themenreiheSchreiben';
import {
  ReiheBasis,
  ReiheKontext,
  type ReiheKontextWert,
  type ReiheStand,
} from './themenreiheKontext';

type Fenster =
  | { art: 'bearbeiten'; reihe: Themenreihe; neu: boolean; fertig?: (id: string) => void }
  | { art: 'uebertragen'; reihe: Themenreihe };

/**
 * **Der Anbieter für den Baustein „Reihe“** – hängt um einen Bildschirm, der ein Protokoll zeigt (Editor, Sitzungsansicht):
 * lädt die Reihen der Gruppe **erst, wenn das Dokument einen Reihe-Block hat** und sie noch nicht da sind (ein Lesen der
 * Mitarbeit; bleibt eine Reihe auch danach aus, wird nicht endlos nachgeladen), hält die Fenster „Reihe“ und „In Events
 * übertragen“ neben dem Editor und reicht beides über `ReiheKontext` an die Blöcke. Ohne `ReiheBasis` (kein App-Rahmen)
 * oder ohne Mitarbeit-Kategorie der Gruppe reicht er nichts – die Blöcke zeigen dann nur ihren Titel.
 */
export function ReiheAnbieter({
  gruppeId,
  dokument,
  children,
}: {
  gruppeId: number;
  dokument: readonly Block[];
  children: ReactNode;
}) {
  const basis = useContext(ReiheBasis);
  const gruppe = basis?.gruppen.find((g) => g.id === gruppeId) ?? null;
  const ort = useMemo(
    () =>
      basis && gruppe?.mitarbeit != null
        ? { modul: basis.modul, kategorie: gruppe.mitarbeit }
        : null,
    [basis, gruppe?.mitarbeit],
  );
  const ids = useMemo(() => themenreiheIds(dokument), [dokument]);
  // Gerade gespeichert und noch nicht neu gelesen – gilt über dem Gelesenen.
  const [lokal, setLokal] = useState<ReadonlyMap<string, Themenreihe>>(new Map());
  const [fenster, setFenster] = useState<Fenster | null>(null);

  const [geladen, setGeladen] = useState<ReadonlyMap<string, Themenreihe> | null>(null);
  const fehlend = ids.filter((id) => !lokal.has(id) && !geladen?.has(id));
  const bedarf = fehlend.join(',');
  const laden = useLaden(
    async () => {
      if (!ort || bedarf === '') return null;
      const liste = await ladeThemenreihen(ort);
      setGeladen(new Map(liste.map((r) => [r.id, r])));
      return true;
    },
    [ort, bedarf],
    { behalten: true },
  );

  const reihen = useMemo(() => new Map([...(geladen ?? []), ...lokal]), [geladen, lokal]);
  const stand: ReiheStand =
    laden.stand.art === 'fehler'
      ? 'fehler'
      : laden.stand.art === 'laedt'
        ? 'laedt'
        : geladen
          ? 'fertig'
          : 'leer';
  const darfBauen = !!basis && !!gruppe && darfSchreibenIn(gruppe, basis.schreibbar);

  // Stabil: das Fenster „In Events übertragen“ liest neu, sobald sich `rechte` ändert.
  const rechte = useMemo(
    () => ({ kalender: basis?.eventKalender ?? [], ich: basis?.ich.person ?? null }),
    [basis],
  );

  const frisch = useCallback(
    async (id: string): Promise<Themenreihe | undefined> => {
      try {
        if (!ort) return undefined;
        const liste = await ladeThemenreihen(ort);
        setGeladen(new Map(liste.map((r) => [r.id, r])));
        setLokal(new Map());
        return liste.find((r) => r.id === id);
      } catch {
        // Vorübergehend ist nicht ungültig: Das Lesen scheiterte – mit dem bekannten Stand weiter, gespeichert wird ohnehin nur
        // gegen den frisch gelesenen (`themenreiheSpeichern`).
        return reihen.get(id);
      }
    },
    [ort, reihen],
  );

  const wert = useMemo<ReiheKontextWert | null>(() => {
    if (!basis || !ort) return null;
    return {
      reihen,
      stand,
      darfBauen,
      // Beide Fenster gehen mit der **frisch gelesenen** Reihe auf: Der Stand im Speicher des Bildschirms kann veraltet
      // sein (jemand anderes hat gespeichert) – „Bitte öffne sie neu“ führte sonst wieder zum selben alten Stand.
      bearbeiten: (id) =>
        void frisch(id).then((r) => r && setFenster({ art: 'bearbeiten', reihe: r, neu: false })),
      uebertragen: (id) =>
        void frisch(id).then((r) => r && setFenster({ art: 'uebertragen', reihe: r })),
      neu: (fertig) => {
        const id = crypto.randomUUID();
        setFenster({
          art: 'bearbeiten',
          neu: true,
          fertig,
          reihe: neueThemenreihe({
            id,
            gruppe: gruppeId,
            name: '',
            zeilen: [neueZeile(crypto.randomUUID(), heuteImKalender())],
            von: basis.ich.person,
            am: new Date().toISOString(),
          }),
        });
      },
      neuLaden: laden.neu,
    };
  }, [basis, ort, reihen, stand, darfBauen, gruppeId, laden.neu, frisch]);

  const gespeichert = useCallback(
    (r: Themenreihe) => {
      setLokal((alt) => new Map(alt).set(r.id, r));
      const f = fenster;
      setFenster(null);
      if (f?.art === 'bearbeiten' && f.neu) f.fertig?.(r.id);
    },
    [fenster],
  );

  return (
    <ReiheKontext.Provider value={wert}>
      {children}
      {basis && ort && fenster?.art === 'bearbeiten' && (
        <BearbeitenFenster
          gruppeId={gruppeId}
          reihe={fenster.reihe}
          neu={fenster.neu}
          ort={ort}
          ich={basis.ich}
          onGespeichert={gespeichert}
          onClose={() => setFenster(null)}
        />
      )}
      {basis && fenster?.art === 'uebertragen' && (
        <ReiheUebertragenFenster
          reihe={fenster.reihe}
          rechte={rechte}
          onClose={() => setFenster(null)}
        />
      )}
    </ReiheKontext.Provider>
  );
}

/** Das Fenster „Reihe“ mit den Mitgliedern der Gruppe (für „Wer“) – erst gelesen, wenn das Fenster aufgeht. */
function BearbeitenFenster(p: {
  gruppeId: number;
  reihe: Themenreihe;
  neu: boolean;
  ort: { modul: number; kategorie: number };
  ich: { person: number };
  onGespeichert: (r: Themenreihe) => void;
  onClose: () => void;
}) {
  const stand = useLaden(() => ladeGruppenMitglieder(p.gruppeId), [p.gruppeId]).stand;
  const mitglieder: readonly Person[] | 'verborgen' | null =
    stand.art === 'fertig' ? stand.daten : stand.art === 'fehler' ? 'verborgen' : null;
  return (
    <ReiheFenster
      reihe={p.reihe}
      neu={p.neu}
      mitglieder={mitglieder}
      ort={p.ort}
      ich={p.ich}
      onGespeichert={p.onGespeichert}
      onClose={p.onClose}
    />
  );
}
