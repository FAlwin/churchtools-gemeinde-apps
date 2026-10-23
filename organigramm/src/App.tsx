import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErweiterungsSeite, type SeitenZustand } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ApiError } from '@ui/ct/fehler';
import { Segment } from '@ui/bedienung/Segment';
import { ReiterLeiste, type Reiter } from '@ui/bedienung/ReiterLeiste';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { baumOhneTypen, knotenNachId, type Knoten } from '@shared/organigramm/gruppen';
import { praesentationAus } from '@shared/organigramm/praesentation';
import { hatBereich, personenImBereich, sichtbereich } from '@shared/organigramm/sichtbereich';
import { hinweiseAus } from '@shared/organigramm/hinweise';
import type { Mitglied } from '@shared/organigramm/mitglieder';
import { ladeStart, type Start } from './start';
import {
  fehlendeNachladen,
  gruppenNachladen,
  ladeMitglieder,
  neueGruppenNachladen,
  type MitgliederDaten,
} from './ladeMitglieder';
import { ladeEinsaetze, type EinsaetzeStand } from './ladeEinsaetze';
import { Organigramm } from './Organigramm';
import { GruppenFenster } from './GruppenFenster';
import { Personen } from './Personen';
import { PersonFenster } from './PersonFenster';
import { Hinweise } from './Hinweise';
import { Praesentation } from './Praesentation';
import { leseAusgeblendet, merkeAusgeblendet } from './auswahl';

type Ansicht = 'organigramm' | 'personen' | 'hinweise';
const REITER: Reiter<Ansicht>[] = [
  { id: 'organigramm', label: 'Organigramm', icon: 'grid' },
  { id: 'personen', label: 'Personen', icon: 'people' },
  { id: 'hinweise', label: 'Hinweise', icon: 'info' },
];
const ansichtAusAdresse = (hash: string): Ansicht =>
  hash === '#personen' ? 'personen' : hash === '#hinweise' ? 'hinweise' : 'organigramm';

/**
 * Das Organigramm in ChurchTools (Bauplan O2/O3): erst Gruppen und Baum (schnell), dann – nebeneinander – die
 * Mitglieder aller Gruppen (gedrosselt) und die Termine mit den Einsätzen. Der Baum steht schon, während beides lädt.
 * Personen und Hinweise gibt es nur für den eigenen Bereich (`sichtbereich`); wer nichts leitet und kein Admin ist,
 * sieht nur das Organigramm – ohne Reiter. Die Präsentation (O4) gibt es für alle; sie blendet dieselben
 * Gruppentypen aus wie der Baum (Alwin, 22.10.2026) – deshalb liegt diese Wahl hier und nicht im Baum.
 */
export function App() {
  const [zustand, setZustand] = useState<SeitenZustand>({ art: 'laedt' });
  const [start, setStart] = useState<Start | null>(null);
  const [mitglieder, setMitglieder] = useState<MitgliederDaten | null>(null);
  const [einsaetze, setEinsaetze] = useState<EinsaetzeStand>({ art: 'laedt' });
  const [offeneGruppe, setOffeneGruppe] = useState<number | null>(null);
  const [offenePerson, setOffenePerson] = useState<number | null>(null);
  const [ausgeblendet, setAusgeblendet] = useState(leseAusgeblendet);
  const [praesentiert, setPraesentiert] = useState(false);
  const [hash, setHash] = useState(() => window.location.hash);
  const handy = useMedienAbfrage('(max-width: 759px)');

  const abgemeldetOderFehler = useCallback(
    (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    [],
  );

  const einsaetzeLaden = useCallback(() => {
    setEinsaetze({ art: 'laedt' });
    ladeEinsaetze().then(
      (x) => setEinsaetze({ art: 'fertig', einsaetze: x }),
      (e: unknown) => {
        // Abgemeldet gilt für alles; jeder andere Fehler ist vorübergehend und betrifft nur die Einsätze.
        if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
        else setEinsaetze({ art: 'fehler' });
      },
    );
  }, [abgemeldetOderFehler]);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then((s) => {
      setStart(s);
      setZustand({ art: 'fertig', vorname: s.vorname, gemeinde: s.gemeinde });
      setMitglieder(null);
      ladeMitglieder(s.gruppen.map((g) => g.id)).then(setMitglieder, abgemeldetOderFehler);
      einsaetzeLaden();
    }, abgemeldetOderFehler);
  }, [abgemeldetOderFehler, einsaetzeLaden]);

  useEffect(laden, [laden]);

  useEffect(() => {
    const folgen = () => setHash(window.location.hash);
    window.addEventListener('hashchange', folgen);
    return () => window.removeEventListener('hashchange', folgen);
  }, []);

  const nachladen = useCallback(() => {
    if (!mitglieder) return;
    fehlendeNachladen(mitglieder).then(setMitglieder, abgemeldetOderFehler);
  }, [mitglieder, abgemeldetOderFehler]);

  // Nach einer Änderung an der Struktur (O5): Gruppen und Hierarchie neu, Mitglieder nur für neue Gruppen. Ein
  // vorübergehender Fehler lässt den bisherigen Stand stehen („vorübergehend ist nicht ungültig“) – nur „abgemeldet“
  // gilt für die ganze Seite.
  const strukturNeu = useCallback(async (): Promise<boolean> => {
    try {
      const s = await ladeStart();
      setStart(s);
      if (mitglieder) {
        setMitglieder(
          await neueGruppenNachladen(
            mitglieder,
            s.gruppen.map((g) => g.id),
          ),
        );
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
      return false;
    }
  }, [mitglieder, abgemeldetOderFehler]);

  // Nach einer Änderung an den Mitgliedern einer Gruppe (O6): nur diese Gruppe neu – über dieselbe Stelle wie das
  // Nachladen gescheiterter Gruppen. Vorübergehende Fehler landen als „nicht ladbar“ bei der Gruppe (wie in O2).
  const mitgliederNeu = useCallback(
    async (gruppeId: number): Promise<boolean> => {
      if (!mitglieder) return false;
      try {
        setMitglieder(await gruppenNachladen(mitglieder, [gruppeId]));
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) abgemeldetOderFehler(e);
        return false;
      }
    },
    [mitglieder, abgemeldetOderFehler],
  );

  const knoten = useMemo(
    () => (start ? knotenNachId(start.baum) : new Map<number, Knoten>()),
    [start],
  );
  const bereich = useMemo(
    () =>
      start
        ? sichtbereich(start.baum, start.geleitet, start.rechte.gruppenVerwalten)
        : new Set<number>(),
    [start],
  );
  const zeigtMehr = !!start && hatBereich(bereich);
  const ansicht: Ansicht = zeigtMehr ? ansichtAusAdresse(hash) : 'organigramm';

  // Lesbare Mitglieder und Anfragen – Grundlage für Personen, Hinweise und das Personenfenster.
  const lesbar = useMemo(() => {
    const m = new Map<number, Mitglied[]>();
    const a = new Map<number, Mitglied[]>();
    for (const [id, s] of mitglieder?.je ?? []) {
      if (s.art !== 'sichtbar') continue;
      m.set(id, s.mitglieder);
      a.set(id, s.angefragt);
    }
    return { mitglieder: m, angefragt: a };
  }, [mitglieder]);
  const personen = useMemo(() => personenImBereich(lesbar.mitglieder, bereich), [lesbar, bereich]);
  const praesentation = useMemo(
    () =>
      praesentiert && start && mitglieder
        ? praesentationAus(
            baumOhneTypen(start.baum, ausgeblendet),
            lesbar.mitglieder,
            start.rollen,
            (id) => mitglieder.personen.get(id)?.name ?? '',
          )
        : null,
    [praesentiert, start, mitglieder, lesbar, ausgeblendet],
  );
  const typUmschalten = (typ: number) => {
    const neu = new Set(ausgeblendet);
    if (neu.has(typ)) neu.delete(typ);
    else neu.add(typ);
    merkeAusgeblendet(neu);
    setAusgeblendet(neu);
  };
  const hinweise = useMemo(
    () =>
      start && mitglieder
        ? hinweiseAus({
            ...lesbar,
            rollen: start.rollen,
            einsaetze: einsaetze.art === 'fertig' ? einsaetze.einsaetze : null,
            dienste: start.dienste,
            bereich,
          })
        : [],
    [start, mitglieder, lesbar, einsaetze, bereich],
  );

  const wechseln = (id: Ansicht) => {
    window.location.hash = id === 'organigramm' ? '' : id;
    setHash(window.location.hash);
  };
  const fertig = zustand.art === 'fertig';
  const oben =
    fertig && zeigtMehr && !handy ? (
      <Segment
        value={ansicht}
        options={REITER.map((r) => ({ value: r.id, label: r.label }))}
        onChange={wechseln}
        ariaLabel="Bereiche"
        verbunden
      />
    ) : undefined;
  const unten =
    fertig && zeigtMehr && handy ? (
      <ReiterLeiste reiter={REITER} aktiv={ansicht} onWechsel={wechseln} />
    ) : undefined;

  const offenerKnoten = offeneGruppe === null ? undefined : knoten.get(offeneGruppe);
  // Personen gibt es nur im eigenen Bereich – eine Person außerhalb öffnet kein Fenster.
  const offenePersonImBereich = offenePerson === null ? undefined : personen.get(offenePerson);
  const gruppeOeffnen = (id: number) => {
    setOffenePerson(null);
    setOffeneGruppe(id);
  };
  const personOeffnen = (id: number) => {
    setOffeneGruppe(null);
    setOffenePerson(id);
  };

  return (
    <ErweiterungsSeite
      app="Organigramm"
      zustand={zustand}
      reiter={oben}
      unten={unten}
      onNochmal={laden}
    >
      {start && ansicht === 'organigramm' && (
        <Organigramm
          start={start}
          mitglieder={mitglieder}
          einsaetze={einsaetze.art === 'fertig' ? einsaetze.einsaetze : null}
          lesbar={lesbar.mitglieder}
          ausgeblendet={ausgeblendet}
          onTypUmschalten={typUmschalten}
          onNachladen={nachladen}
          onGruppe={gruppeOeffnen}
          onPraesentieren={() => setPraesentiert(true)}
        />
      )}
      {start && ansicht === 'personen' && (
        <Personen
          start={start}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          bereich={bereich}
          onPerson={personOeffnen}
          onEinsaetzeNachladen={einsaetzeLaden}
        />
      )}
      {start && ansicht === 'hinweise' && (
        <Hinweise
          start={start}
          hinweise={hinweise}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          onGruppe={gruppeOeffnen}
          onPerson={personOeffnen}
          onEinsaetzeNachladen={einsaetzeLaden}
        />
      )}
      {start && offenerKnoten && (
        <GruppenFenster
          key={offenerKnoten.gruppe.id}
          start={start}
          knoten={offenerKnoten}
          mitglieder={mitglieder}
          onGruppe={gruppeOeffnen}
          onNachladen={nachladen}
          onSchliessen={() => setOffeneGruppe(null)}
          onStruktur={strukturNeu}
          onMitgliederNeu={() => mitgliederNeu(offenerKnoten.gruppe.id)}
        />
      )}
      {start && offenePersonImBereich && (
        <PersonFenster
          start={start}
          person={offenePersonImBereich}
          mitglieder={mitglieder}
          einsaetze={einsaetze}
          onGruppe={gruppeOeffnen}
          onSchliessen={() => setOffenePerson(null)}
        />
      )}
      {start && mitglieder && praesentation && (
        <Praesentation
          start={start}
          daten={praesentation}
          mitglieder={mitglieder}
          onSchliessen={() => setPraesentiert(false)}
        />
      )}
    </ErweiterungsSeite>
  );
}
