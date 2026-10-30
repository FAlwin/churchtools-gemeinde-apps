import { useCallback, useEffect, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { FilterKnopf, type FilterAbschnitt } from '@ui/bedienung/FilterKnopf';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';
import { tagKurz } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  istUeberfaellig,
  statusSetzen,
  type Aufgabe,
  type AufgabenStatus,
} from '@shared/protokolle/aufgaben';
import {
  einteilen,
  langeErledigt,
  sichtbarFuer,
  zustaendigFuer,
  type Einteilung,
  type ToDoEintrag,
} from '@shared/protokolle/uebersicht';
import { aufgabeAendern } from './aufgabenSchreiben';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { ladeGruppenMitglieder } from './mitglieder';
import { Marke } from './Marke';
import { StatusMarke } from './StatusMarke';
import styles from './ToDos.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; uebersicht: GruppenUebersicht[] };

const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Gemerkt im Gerät: Einteilung und Filter (ausgeschaltete Werte). Ältere Erledigte sind **kein** Filter – sonst stünde
 * am Filter-Knopf ab Werk eine „1“, und eine Anzeige, die immer leuchtet, sagt nichts mehr; sie haben einen eigenen
 * Schalter am Ende der Liste.
 */
const MERK_NACH = 'protokolle.todos.nach';
const MERK_AUS = 'protokolle.todos.aus';
interface Aus {
  gruppen: string[];
  zustaendig: string[];
}
const AUS_VORGABE: Aus = { gruppen: [], zustaendig: [] };

const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Wer zuständig ist: Bilder und Vornamen; Externe als Name; wen man nicht kennt (Mitglieder verborgen), als Zahl. */
function Wer({ a, personen }: { a: Aufgabe; personen: ReadonlyMap<number, Person> }) {
  const bekannt = a.wer.flatMap((p) => {
    const x = personen.get(p);
    return x ? [x] : [];
  });
  const fremd = a.wer.length - bekannt.length;
  const namen = [
    ...bekannt.map((p) => p.name.split(' ')[0]),
    ...(a.extern.trim() ? [a.extern.trim()] : []),
    ...(fremd ? [`${fremd === 1 ? 'eine weitere Person' : `${fremd} weitere`}`] : []),
  ];
  if (!namen.length) return <span className={styles.niemand}>noch niemand zuständig</span>;
  return (
    <span className={styles.wer}>
      {bekannt.length > 0 && (
        <span className={styles.bilder}>
          {bekannt.map((p) => (
            <PersonBild
              key={p.id}
              name={p.name}
              bild={p.bild}
              initialen={p.initialen}
              groesse={20}
            />
          ))}
        </span>
      )}
      {namen.join(', ')}
    </span>
  );
}

/**
 * **Reiter „To-Dos“** (Bauplan S7-1, entschieden 30.10.2026; Entwurf `s7-todos-v2.html`): alle To-Dos meiner Gruppen
 * als Liste – nach Status oder nach Person eingeteilt, mit Filter (Gruppen, zuständig); ältere Erledigte per Schalter. Die Leitung
 * sieht alle To-Dos ihrer Gruppen, Mitglieder ihre eigenen und die ohne Zuständigen (`sichtbarFuer`). Der Status wird
 * über die Marke direkt geändert – ohne ins Protokoll zu springen, auch bei freigegebenen Protokollen. Ein Tipp auf den
 * Text öffnet die Sitzung, aus der das To-Do stammt (das Fenster „To-Do“ kommt mit S7-2).
 */
export function ToDos({
  modul,
  ich,
  gruppen,
  schreibbar,
  onSitzung,
}: {
  modul: number;
  ich: { person: number; name: string };
  gruppen: ProtokollGruppe[];
  /** Kategorien, in denen man schreiben darf (`Start.schreibbar`) – wer „Protokolle“ schreibt, ist Leitung. */
  schreibbar: readonly number[];
  onSitzung: (gruppe: number, sitzung: string) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [personen, setPersonen] = useState<ReadonlyMap<number, Person>>(new Map());
  const [nach, setNach] = useState<Einteilung>(() =>
    leseImGeraet<Einteilung>(MERK_NACH, 'status', (x) => (x === 'person' ? 'person' : 'status')),
  );
  const [aus, setAus] = useState<Aus>(() =>
    leseImGeraet<Aus>(MERK_AUS, AUS_VORGABE, (x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { gruppen: texte(o.gruppen), zustaendig: texte(o.zustaendig) };
    }),
  );
  const [aeltere, setAeltere] = useState(false);
  const [laeuft, setLaeuft] = useState<ReadonlySet<string>>(new Set());
  const [hinweis, setHinweis] = useState<string | null>(null);
  const heute = heuteImKalender();

  const laden = useCallback(() => {
    if (!gruppen.length) return setZustand({ art: 'fertig', uebersicht: [] });
    setZustand({ art: 'laedt' });
    ladeUebersicht(modul, gruppen, zeitzone).then(
      (uebersicht) => setZustand({ art: 'fertig', uebersicht }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    // Namen und Bilder der Zuständigen – fehlen sie (Mitglieder verborgen, Netz), zeigt die Liste nur Zahlen.
    void Promise.allSettled(gruppen.map((g) => ladeGruppenMitglieder(g.id))).then((alle) => {
      const je = new Map<number, Person>();
      for (const r of alle)
        if (r.status === 'fulfilled' && r.value !== 'verborgen')
          for (const p of r.value) je.set(p.id, p);
      setPersonen(je);
    });
  }, [modul, gruppen]);

  useEffect(laden, [laden]);

  const nachSetzen = (n: Einteilung) => {
    setNach(n);
    merkeImGeraet(MERK_NACH, n);
  };
  const ausSetzen = (teil: Partial<Aus>) => {
    const neu = { ...aus, ...teil };
    setAus(neu);
    merkeImGeraet(MERK_AUS, neu);
  };

  const ue = zustand.art === 'fertig' ? zustand.uebersicht : [];
  // Mitglieder dürfen die Mitgliederliste oft nicht sehen (`verborgen`) – sich selbst kennt man trotzdem (beim Prüfen in
  // der Test-Instanz 30.10.2026 gefunden: bei Spikes eigenen To-Dos stand „eine weitere Person“).
  const bekannte: ReadonlyMap<number, Person> = personen.has(ich.person)
    ? personen
    : new Map([
        ...personen,
        [
          ich.person,
          { id: ich.person, name: ich.name, bild: null, initialen: initialenAus(ich.name) },
        ],
      ]);
  const leitungIn = (g: ProtokollGruppe) =>
    g.protokolle !== null && schreibbar.includes(g.protokolle);
  const sichtbar: ToDoEintrag[] = ue.flatMap((u) =>
    u.aufgaben
      .filter((a) => sichtbarFuer(a, { ich: ich.person, leitung: leitungIn(u.gruppe) }))
      .map((a) => ({ aufgabe: a, gruppe: u.gruppe })),
  );
  const gefiltert = sichtbar.filter(
    (e) =>
      !aus.gruppen.includes(String(e.gruppe.id)) &&
      !aus.zustaendig.includes(zustaendigFuer(e.aufgabe, ich.person)),
  );
  const alteErledigte = gefiltert.filter((e) => langeErledigt(e.aufgabe, heute)).length;
  const gezeigt = aeltere ? gefiltert : gefiltert.filter((e) => !langeErledigt(e.aufgabe, heute));
  const namen = new Map([...bekannte].map(([id, p]) => [id, p.name]));
  const bereiche = einteilen(gezeigt, { nach, heute, ich: ich.person, namen });
  const mehrereGruppen = new Set(gezeigt.map((e) => e.gruppe.id)).size > 1;
  const irgendwoLeitung = gruppen.some(leitungIn);

  const filter: FilterAbschnitt[] = [
    {
      titel: 'Gruppen',
      optionen: ue.map((u) => ({ wert: String(u.gruppe.id), text: u.gruppe.name })),
      aus: aus.gruppen,
      onAus: (x) => ausSetzen({ gruppen: x }),
    },
    {
      titel: 'Zuständig',
      optionen: [
        { wert: 'ich', text: 'Ich' },
        ...(irgendwoLeitung ? [{ wert: 'andere', text: 'Andere' }] : []),
        { wert: 'niemand', text: 'Noch niemand' },
      ],
      aus: aus.zustaendig,
      onAus: (x) => ausSetzen({ zustaendig: x }),
    },
  ];

  const statusAendern = (e: ToDoEintrag, neu: AufgabenStatus) => {
    const u = ue.find((x) => x.gruppe.id === e.gruppe.id);
    if (!u || u.gruppe.mitarbeit === null) return;
    const id = e.aufgabe.id;
    setHinweis(null);
    setLaeuft((s) => new Set(s).add(id));
    aufgabeAendern(
      { modul, kategorie: u.gruppe.mitarbeit },
      id,
      (a) => statusSetzen(a, neu, ich.person, new Date().toISOString()),
      () => {
        // 409 statt einfachem Fehler: `fehlerMeldung` zeigt den Text, statt „ChurchTools antwortet gerade nicht“.
        throw new ApiError(409, 'Dieses To-Do gibt es nicht mehr – bitte neu laden.');
      },
    )
      .then(
        (gespeichert) =>
          setZustand((z) =>
            z.art !== 'fertig'
              ? z
              : {
                  art: 'fertig',
                  uebersicht: z.uebersicht.map((x) =>
                    x.gruppe.id !== u.gruppe.id
                      ? x
                      : { ...x, aufgaben: x.aufgaben.map((a) => (a.id === id ? gespeichert : a)) },
                  ),
                },
          ),
        (f: unknown) => setHinweis(fehlerMeldung(f).text),
      )
      .finally(() =>
        setLaeuft((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      );
  };

  const zeile = (e: ToDoEintrag) => {
    const a = e.aufgabe;
    const u = ue.find((x) => x.gruppe.id === e.gruppe.id);
    const herkunft =
      u &&
      a.sitzung !== null &&
      [...u.sitzungen.kommend, ...u.sitzungen.protokolle].find(
        (s) => s.kopf?.sitzung === a.sitzung,
      );
    const ueber = istUeberfaellig(a, heute);
    const text = (
      <span className={a.status === 'erledigt' ? styles.erledigt : undefined}>{a.text}</span>
    );
    return (
      <li key={`${e.gruppe.id}:${a.id}`} className={styles.zeile}>
        {herkunft ? (
          <button
            type="button"
            className={styles.text}
            title={`Im Protokoll „${herkunft.titel}“ zeigen`}
            onClick={() => onSitzung(e.gruppe.id, herkunft.schluessel)}
          >
            {text}
          </button>
        ) : (
          <span className={styles.text}>{text}</span>
        )}
        <span className={styles.meta}>
          <StatusMarke
            status={a.status}
            beschaeftigt={laeuft.has(a.id)}
            onWechsel={
              u && u.gruppe.mitarbeit !== null ? (neu) => statusAendern(e, neu) : undefined
            }
          />
          <Wer a={a} personen={bekannte} />
          {a.bis && (
            <span className={ueber ? styles.ueberfaellig : styles.frist}>
              {ueber ? 'überfällig · ' : 'bis '}
              {tagKurz(a.bis)}
            </span>
          )}
          {mehrereGruppen && <Marke art="leise">{e.gruppe.name}</Marke>}
        </span>
      </li>
    );
  };

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        <h2>To-Dos</h2>
        <span className={styles.werkzeug}>
          <Segment
            value={nach}
            options={[
              { value: 'status', label: 'Nach Status' },
              { value: 'person', label: 'Nach Person' },
            ]}
            onChange={nachSetzen}
            ariaLabel="Einteilen"
            verbunden
          />
          <FilterKnopf abschnitte={filter} />
        </span>
      </div>
      {!irgendwoLeitung && gruppen.length > 0 && (
        <p className={styles.ruhig}>
          Du siehst deine eigenen To-Dos und die, für die noch niemand zuständig ist.
        </p>
      )}
      {hinweis && (
        <p className={styles.fehler} role="alert">
          {hinweis}
        </p>
      )}
      {zustand.art === 'laedt' && <p className={styles.ruhig}>Wird geladen …</p>}
      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />}
      {zustand.art === 'fertig' && (
        <section className={styles.karte} aria-label="To-Dos">
          {!gruppen.length ? (
            <p className={styles.innen}>Du bist in keiner Gruppe, die hier Protokolle führt.</p>
          ) : !sichtbar.length ? (
            <p className={styles.innen}>Keine To-Dos.</p>
          ) : !bereiche.length ? (
            <p className={styles.innen}>
              Keine To-Dos für diese Auswahl – der Filter blendet alle aus.
            </p>
          ) : (
            bereiche.map((b) => (
              <div key={b.schluessel} role="group" aria-label={b.titel}>
                <h3
                  className={
                    b.art === 'ueberfaellig' ? `${styles.bereich} ${styles.rot}` : styles.bereich
                  }
                >
                  {gross(b.titel)}
                  <span className={styles.anzahl}>{b.eintraege.length}</span>
                </h3>
                <ul className={styles.liste}>{b.eintraege.map(zeile)}</ul>
              </div>
            ))
          )}
          {(alteErledigte > 0 || aeltere) && (
            <button
              type="button"
              className={styles.schalterZeile}
              aria-pressed={aeltere}
              onClick={() => setAeltere(!aeltere)}
            >
              <Schalter an={aeltere} />
              Ältere erledigte zeigen{alteErledigte ? ` (${alteErledigte})` : ''}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
