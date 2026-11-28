import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { themenreiheIds, type Block } from '@shared/protokolle/dokument';
import type { Themenreihe } from '@shared/protokolle/themenreihe';
import { darfSchreibenIn } from '@shared/protokolle/zugang';
import { ladeThemenreihen } from './themenreiheSchreiben';
import {
  ReiheBasis,
  ReiheKontext,
  type ReiheKontextWert,
  type ReiheStand,
} from './themenreiheKontext';
import { useReiheFenster } from './useReiheFenster';

/** Dieselbe leere Liste bei jedem Aufruf – ein neues `[]` je Render ließe das Fenster „Event anlegen“ endlos neu laden. */
const KEINE: readonly number[] = [];

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

  const ortVon = useCallback(() => ort, [ort]);
  const bekannt = useCallback((id: string) => reihen.get(id), [reihen]);
  const onFrisch = useCallback((_g: number, liste: readonly Themenreihe[]) => {
    setGeladen(new Map(liste.map((r) => [r.id, r])));
    setLokal(new Map());
  }, []);
  const onGespeichert = useCallback(
    (r: Themenreihe) => setLokal((alt) => new Map(alt).set(r.id, r)),
    [],
  );
  const { bearbeiten, uebertragen, neu, fenster } = useReiheFenster({
    ortVon,
    bekannt,
    onFrisch,
    onGespeichert,
    ich: basis?.ich ?? null,
    eventKalender: basis ? basis.eventKalender : [],
    eventAnlegen: basis ? basis.eventAnlegen : KEINE,
  });

  const wert = useMemo<ReiheKontextWert | null>(() => {
    if (!basis || !ort) return null;
    return {
      reihen,
      stand,
      darfBauen,
      // Beide Fenster gehen mit der **frisch gelesenen** Reihe auf (`useReiheFenster`).
      bearbeiten: (id) => bearbeiten({ id, gruppe: gruppeId }),
      uebertragen: (id) => uebertragen({ id, gruppe: gruppeId }),
      neu: (fertig) => neu({ gruppe: gruppeId, fertig }),
      neuLaden: laden.neu,
    };
  }, [basis, ort, reihen, stand, darfBauen, gruppeId, laden.neu, bearbeiten, uebertragen, neu]);

  return (
    <ReiheKontext.Provider value={wert}>
      {children}
      {basis && ort && fenster}
    </ReiheKontext.Provider>
  );
}
