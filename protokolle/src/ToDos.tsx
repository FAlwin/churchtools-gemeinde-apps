import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { FilterKnopf, type FilterAbschnitt } from '@ui/bedienung/FilterKnopf';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { WahlKnopf } from '@ui/bedienung/WahlKnopf';
import { tagKurz } from '@shared/ct/datum';
import { gemeindeZeitzone, heuteImKalender } from '@shared/ct/zeit';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  bearbeiten,
  istUeberfaellig,
  letzteNotiz,
  nameFuer,
  nameImVerlauf,
  weitereZustaendige,
  zustaendigKurz,
  type Aufgabe,
  type AufgabenStatus,
  type HakenSchritt,
  type ToDoAenderung,
} from '@shared/protokolle/aufgaben';
import {
  ablegen,
  einteilen,
  eintragSchluessel,
  langeErledigt,
  ohneHerkunft,
  sichtbarFuer,
  sortieren,
  spalten,
  umordnen,
  zustaendigFuer,
  type Sortierung,
  type Spalte,
  type ToDoEintrag,
} from '@shared/protokolle/uebersicht';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { ladeGruppenMitglieder } from './mitglieder';
import { Marke } from './Marke';
import { Haken } from './Haken';
import { ToDoFenster, type Herkunft } from './ToDoFenster';
import { toDoAendern } from './todoSchreiben';
import { ToDoZiehBereich, ZiehKarte, ZiehSpalte } from './ToDoZiehen';
import { useToDoEinstellungen } from './useToDoEinstellungen';
import type { AufgabenStand } from './useFaellige';
import styles from './ToDos.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; uebersicht: GruppenUebersicht[] };

/*
 * Gemerkt (`useToDoEinstellungen`): Ansicht, Einteilung, Filter, Sortierung, meine Reihenfolge. Ältere Erledigte sind
 * **kein** Filter – sonst stünde am Filter-Knopf ab Werk eine „1“, und eine Anzeige, die immer leuchtet, sagt nichts mehr;
 * sie haben einen eigenen Schalter am Ende.
 */
const SORTIERUNGEN: { wert: Sortierung; text: string }[] = [
  { wert: 'dringlichkeit', text: 'Dringlichkeit' },
  { wert: 'bis', text: 'Bis-Datum' },
  { wert: 'alpha', text: 'Alphabetisch' },
  { wert: 'manuell', text: 'Manuell' },
];

/** Eine Abgabe, die erst bestätigt werden muss (Mitglied gibt sein eigenes To-Do ab, S7-3). */
interface Frage {
  e: ToDoEintrag;
  x: ToDoAenderung;
  an: string;
}

const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Wie lange eine eben abgehakte Karte an ihrem Platz bleibt (mit „Rückgängig“ an der Karte), bevor sie weiterrutscht. */
export const HALTEN_MS = 5000;

/** Eine eben abgehakte Karte: wie sie vorher stand (für ihren Platz) und was „Rückgängig“ ändert. */
interface Gehalten {
  vorher: Aufgabe;
  zurueck: ToDoAenderung;
}

/**
 * Wer zuständig ist: Bilder und Vornamen; Externe als Name; wen man nicht kennt (Mitglieder verborgen), mit dem Namen aus
 * dem Verlauf oder als Zahl (`weitereZustaendige`).
 */
function Wer({ a, personen }: { a: Aufgabe; personen: ReadonlyMap<number, Person> }) {
  const bekannt = a.wer.flatMap((p) => {
    const x = personen.get(p);
    return x ? [x] : [];
  });
  const namen = [
    ...bekannt.map((p) => p.name.split(' ')[0]),
    ...(a.extern.trim() ? [a.extern.trim()] : []),
    ...weitereZustaendige(
      a,
      a.wer.filter((p) => !personen.has(p)),
    ),
  ];
  if (!namen.length) return <span className={styles.niemand}>noch niemand zuständig</span>;
  // Höchstens 3 Bilder und Namen, danach „+N“ (W5) – die volle Liste steht im Tooltip und für Screenreader.
  const kurz = zustaendigKurz(namen);
  return (
    <span
      className={styles.wer}
      {...(kurz.gekuerzt
        ? { title: kurz.voll, role: 'group', 'aria-label': `Zuständig: ${kurz.voll}` }
        : {})}
    >
      {bekannt.length > 0 && (
        <span className={styles.bilder}>
          {bekannt.slice(0, 3).map((p) => (
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
      {kurz.text}
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
  onAufgaben,
}: {
  modul: number;
  ich: { person: number; name: string };
  gruppen: ProtokollGruppe[];
  /** Kategorien, in denen man schreiben darf (`Start.schreibbar`) – wer „Protokolle“ schreibt, ist Leitung. */
  schreibbar: readonly number[];
  onSitzung: (gruppe: number, sitzung: string) => void;
  /** Gelesene To-Dos je Gruppe nach oben geben (Zähler am Reiter) – auch nach jeder Änderung hier. */
  onAufgaben?: (stand: readonly AufgabenStand[]) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [mitglieder, setMitglieder] = useState<ReadonlyMap<number, Person[] | 'verborgen'>>(
    new Map(),
  );
  // Fenster „To-Do“: `eintrag` null = „Neues To-Do“ (aus einer Board-Spalte mit Vorbelegung).
  const [fenster, setFenster] = useState<{
    eintrag: ToDoEintrag | null;
    vorlage?: { status?: AufgabenStatus; wer?: number[] };
  } | null>(null);
  const [einst, setzen] = useToDoEinstellungen(ich.person);
  const { ansicht, nach, aus, sortierung, reihenfolge } = einst;
  const [frage, setFrage] = useState<Frage | null>(null);
  const [aeltere, setAeltere] = useState(false);
  const [laeuft, setLaeuft] = useState<ReadonlySet<string>>(new Set());
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Eben abgehakte Karten bleiben `HALTEN_MS` an ihrem Platz – mit „Rückgängig“ an der Karte selbst (W8a).
  const [gehalten, setGehalten] = useState<ReadonlyMap<string, Gehalten>>(new Map());
  const timer = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timer.current;
    return () => t.forEach((id) => clearTimeout(id));
  }, []);
  const heute = heuteImKalender();

  // `still`: nach dem Speichern im Fenster ohne „Wird geladen …“ – die Liste bleibt stehen, bis das Neue da ist.
  const holen = useCallback(
    (still: boolean) => {
      if (!gruppen.length) return setZustand({ art: 'fertig', uebersicht: [] });
      if (!still) setZustand({ art: 'laedt' });
      ladeUebersicht(modul, gruppen, gemeindeZeitzone()).then(
        (uebersicht) => setZustand({ art: 'fertig', uebersicht }),
        (e: unknown) =>
          still
            ? setHinweis(fehlerMeldung(e).text)
            : setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
      );
      // Namen und Bilder der Zuständigen – fehlen sie (Mitglieder verborgen, Netz), zeigt die Liste nur Zahlen.
      void Promise.allSettled(gruppen.map((g) => ladeGruppenMitglieder(g.id))).then((alle) =>
        setMitglieder(
          new Map(
            alle.flatMap((r, i) =>
              r.status === 'fulfilled' ? [[gruppen[i].id, r.value] as const] : [],
            ),
          ),
        ),
      );
    },
    [modul, gruppen],
  );
  const laden = useCallback(() => holen(false), [holen]);

  useEffect(laden, [laden]);

  // Jeder Stand der Übersicht (frisch gelesen, sofort gezeigt, zurückgerollt) speist den Zähler am Reiter.
  useEffect(() => {
    if (zustand.art === 'fertig')
      onAufgaben?.(zustand.uebersicht.map((u) => ({ gruppe: u.gruppe.id, aufgaben: u.aufgaben })));
  }, [zustand, onAufgaben]);

  const ausSetzen = (teil: Partial<typeof aus>) => setzen({ aus: { ...aus, ...teil } });

  const ue = zustand.art === 'fertig' ? zustand.uebersicht : [];
  const personen = new Map<number, Person>();
  for (const l of mitglieder.values())
    if (l !== 'verborgen') for (const p of l) personen.set(p.id, p);
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
  const sichtbarGezeigt = aeltere
    ? gefiltert
    : gefiltert.filter((e) => !langeErledigt(e.aufgabe, heute));
  // Eine gehaltene Karte steht mit ihrem alten Stand in der Einteilung – so bleibt sie an ihrem Platz.
  const gezeigt = sichtbarGezeigt.map((e) => {
    const g = gehalten.get(eintragSchluessel(e));
    return g ? { ...e, aufgabe: g.vorher } : e;
  });
  const namen = new Map([...bekannte].map(([id, p]) => [id, p.name]));
  // Wen die Liste nicht kennt, kennt vielleicht der Verlauf („nach Person“ zeigte sonst „Person 1“).
  for (const e of sichtbar)
    for (const p of e.aufgabe.wer) {
      const n = namen.has(p) ? null : nameImVerlauf(e.aufgabe, p);
      if (n) namen.set(p, n);
    }
  const sortiert = <T extends { eintraege: ToDoEintrag[] }>(b: T): T => ({
    ...b,
    eintraege: sortieren(b.eintraege, { art: sortierung, reihenfolge }),
  });
  const bereiche = einteilen(gezeigt, { nach, heute, ich: ich.person, namen }).map(sortiert);
  // Nach Person mit genau einer Gruppe im Blick: auch deren Mitglieder ohne To-Do als Spalte (man will ihnen eins geben).
  const imBlick = ue.filter((u) => !aus.gruppen.includes(String(u.gruppe.id)));
  const ihreMitglieder = imBlick.length === 1 ? mitglieder.get(imBlick[0].gruppe.id) : undefined;
  const boardSpalten: Spalte[] = spalten(gezeigt, {
    nach,
    heute,
    ich: ich.person,
    namen,
    mitglieder: Array.isArray(ihreMitglieder) ? ihreMitglieder.map((p) => p.id) : [],
  }).map(sortiert);
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

  /** Ein To-Do im Stand der Übersicht ersetzen. */
  const ersetzen = (gruppe: number, a: Aufgabe) =>
    setZustand((z) =>
      z.art !== 'fertig'
        ? z
        : {
            art: 'fertig',
            uebersicht: z.uebersicht.map((x) =>
              x.gruppe.id !== gruppe
                ? x
                : { ...x, aufgaben: x.aufgaben.map((b) => (b.id === a.id ? a : b)) },
            ),
          },
    );

  /**
   * **Status oder Zuständige ändern** (Status-Marke, Ziehen im Board) – ein Weg. Sofort zeigen (sonst springt die Karte
   * nach dem Loslassen zurück), dann schreiben; ChurchTools' Stand gilt. Scheitert es, kommt der alte Stand zurück.
   */
  const aendern = (e: ToDoEintrag, x: ToDoAenderung, beiFehler?: () => void) => {
    const u = ue.find((v) => v.gruppe.id === e.gruppe.id);
    if (!u || u.gruppe.mitarbeit === null) return;
    const id = e.aufgabe.id;
    setHinweis(null);
    setLaeuft((s) => new Set(s).add(id));
    ersetzen(u.gruppe.id, bearbeiten(e.aufgabe, x, ich.person, new Date().toISOString()));
    toDoAendern({ modul, kategorie: u.gruppe.mitarbeit }, id, x, ich)
      .then(
        (gespeichert) => ersetzen(u.gruppe.id, gespeichert),
        (f: unknown) => {
          ersetzen(u.gruppe.id, e.aufgabe);
          setHinweis(fehlerMeldung(f).text);
          beiFehler?.();
        },
      )
      .finally(() =>
        setLaeuft((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      );
  };

  const loslassen = (schluessel: string) => {
    clearTimeout(timer.current.get(schluessel));
    timer.current.delete(schluessel);
    setGehalten((m) => {
      const n = new Map(m);
      n.delete(schluessel);
      return n;
    });
  };

  /**
   * **Der Haken an der Karte** (W8a): abhaken oder zurücknehmen – ein Weg (`hakenSchritt`). Nach dem Abhaken bleibt die Karte
   * `HALTEN_MS` an ihrem Platz, durchgestrichen, mit „Rückgängig“ direkt an der Karte (nie in einer Leiste am Seitenende).
   */
  const haken = (e: ToDoEintrag, s: HakenSchritt) => {
    const vorher = e.aufgabe;
    const k = eintragSchluessel(e);
    // Scheitert das Schreiben, ist nichts erledigt – dann auch kein „Rückgängig“.
    const beiFehler = () => loslassen(k);
    if (s.art === 'teil')
      aendern(e, { teile: [{ person: s.person, fertig: s.fertig }] }, beiFehler);
    else aendern(e, { status: s.neu }, beiFehler);
    const erledigt = s.art === 'teil' ? s.fertig : s.neu === 'erledigt';
    if (!erledigt) return;
    clearTimeout(timer.current.get(k));
    timer.current.set(
      k,
      setTimeout(() => loslassen(k), HALTEN_MS),
    );
    setGehalten((m) =>
      new Map(m).set(k, {
        vorher,
        zurueck:
          s.art === 'teil'
            ? { teile: [{ person: s.person, fertig: false }] }
            : { status: vorher.status },
      }),
    );
  };

  /** Im Board abgelegt (S7-3): was das heißt, sagt `ablegen`; gibt ein Mitglied sein To-Do ab, erst nachfragen. */
  const abgelegt = (karte: string, von: string, nach_: string) => {
    const e = gezeigt.find((x) => eintragSchluessel(x) === karte);
    const v = boardSpalten.find((s) => s.schluessel === von);
    const n = boardSpalten.find((s) => s.schluessel === nach_);
    if (!e || !v || !n) return;
    const x = ablegen(e.aufgabe, v, n);
    if (!x) return;
    const danach = bearbeiten(e.aufgabe, x, ich.person, new Date().toISOString());
    const g = ue.find((u) => u.gruppe.id === e.gruppe.id)?.gruppe;
    const leitung = !!g && leitungIn(g);
    if (!sichtbarFuer(danach, { ich: ich.person, leitung })) return setFrage({ e, x, an: n.titel });
    aendern(e, x);
  };

  const umgeordnet = (spalte: string, karte: string, vor: string | null) => {
    const quelle = ansicht === 'board' ? boardSpalten : bereiche;
    const s = quelle.find((b) => b.schluessel === spalte);
    if (!s) return;
    setzen({ reihenfolge: umordnen(reihenfolge, s.eintraege.map(eintragSchluessel), karte, vor) });
  };

  /** Aus welcher Sitzung – und ob ihr Protokoll noch ein Entwurf ist (dort führt das Protokoll). */
  const herkunftVon = (e: ToDoEintrag): Herkunft | null => {
    const u = ue.find((x) => x.gruppe.id === e.gruppe.id);
    const s =
      u &&
      e.aufgabe.sitzung !== null &&
      [...u.sitzungen.kommend, ...u.sitzungen.protokolle].find(
        (x) => x.kopf?.sitzung === e.aufgabe.sitzung,
      );
    return s
      ? { titel: s.titel, schluessel: s.schluessel, entwurf: s.kopf?.status === 'entwurf' }
      : null;
  };
  const mitMitarbeit = gruppen.filter((g) => g.mitarbeit !== null);

  /** Was auf einer Karte steht – in Liste und Board derselbe Baustein (Entwurf v2). */
  const inhalt = (e: ToDoEintrag) => {
    const k = eintragSchluessel(e);
    const g = gehalten.get(k);
    // Gehalten: die Karte steht mit dem alten Stand am alten Platz, gezeigt wird der aktuelle.
    const a = (g && sichtbarGezeigt.find((x) => eintragSchluessel(x) === k)?.aufgabe) || e.aufgabe;
    const u = ue.find((x) => x.gruppe.id === e.gruppe.id);
    const herkunft = herkunftVon(e);
    const notiz = a.karte?.notiz ? letzteNotiz(a) : null;
    const ueber = istUeberfaellig(a, heute);
    const text = (
      <span className={a.status === 'erledigt' || g ? styles.erledigt : undefined}>{a.text}</span>
    );
    return (
      <>
        <button
          type="button"
          className={styles.text}
          title="To-Do öffnen"
          onClick={() => setFenster({ eintrag: e })}
        >
          {text}
        </button>
        <span className={styles.meta}>
          <Haken
            a={a}
            ich={ich.person}
            art="marke"
            beschaeftigt={laeuft.has(a.id)}
            onSchritt={u && u.gruppe.mitarbeit !== null && !g ? (s) => haken(e, s) : undefined}
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
        {g && (
          <span className={styles.rueckgaengig} role="status">
            Erledigt
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                loslassen(k);
                aendern(e, g.zurueck);
              }}
            >
              Rückgängig
            </button>
          </span>
        )}
        {a.karte?.notiz && (
          <span className={styles.abschnitt}>
            <b>Notizen</b>
            {notiz ? (
              <span>
                {notiz.text}{' '}
                <span className={styles.leise}>
                  –{' '}
                  {notiz.von === ich.person
                    ? ich.name
                    : (nameFuer(a, notiz.von, namen) ?? 'jemand')}
                </span>
              </span>
            ) : (
              <span>Noch keine Notiz.</span>
            )}
          </span>
        )}
        {a.karte?.sitzung && a.sitzung !== null && (
          <span className={styles.abschnitt}>
            <b>Aus welcher Sitzung</b>
            {herkunft ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => onSitzung(e.gruppe.id, herkunft.schluessel)}
              >
                {herkunft.titel} – im Protokoll zeigen
              </button>
            ) : (
              <span>{ohneHerkunft(a)}</span>
            )}
          </span>
        )}
      </>
    );
  };

  const zieh = (l: readonly { schluessel: string; eintraege: ToDoEintrag[] }[]) =>
    new Map(l.map((b) => [b.schluessel, b.eintraege.map(eintragSchluessel)]));
  const bild = (karte: string): ReactNode => {
    const e = gezeigt.find((x) => eintragSchluessel(x) === karte);
    return e ? (
      <ul className={styles.liste}>{<li className={styles.zeile}>{inhalt(e)}</li>}</ul>
    ) : null;
  };
  const altSchalter = (alteErledigte > 0 || aeltere) && (
    <button
      type="button"
      className={styles.schalterZeile}
      aria-pressed={aeltere}
      onClick={() => setAeltere(!aeltere)}
    >
      <Schalter an={aeltere} />
      Ältere erledigte zeigen{alteErledigte ? ` (${alteErledigte})` : ''}
    </button>
  );
  const leer = !gruppen.length ? (
    <p className={styles.innen}>Du bist in keiner Gruppe, die hier Protokolle führt.</p>
  ) : !sichtbar.length ? (
    <p className={styles.innen}>Keine To-Dos.</p>
  ) : null;

  /** „+ Neues To-Do“ in einer Board-Spalte: Status bzw. Zuständige vorbelegt. */
  const vorlageFuer = (sp: Spalte): { status?: AufgabenStatus; wer?: number[] } =>
    sp.art === 'offen' || sp.art === 'arbeit'
      ? { status: sp.art }
      : sp.art === 'person' && sp.person !== undefined
        ? { wer: [sp.person] }
        : { wer: [] };

  return (
    <div className={ansicht === 'board' ? `${styles.seite} ${styles.breit}` : styles.seite}>
      <div className={styles.kopf}>
        <h2>To-Dos</h2>
        <span className={styles.werkzeug}>
          <Segment
            value={ansicht}
            options={[
              { value: 'liste', label: 'Liste' },
              { value: 'board', label: 'Board' },
            ]}
            onChange={(a) => setzen({ ansicht: a })}
            ariaLabel="Ansicht"
            verbunden
          />
          <Segment
            value={nach}
            options={[
              { value: 'status', label: 'Nach Status' },
              { value: 'person', label: 'Nach Person' },
            ]}
            onChange={(n) => setzen({ nach: n })}
            ariaLabel="Einteilen"
            verbunden
            className={styles.einteilen}
          />
          <WahlKnopf
            titel="Sortieren"
            icon="sortieren"
            optionen={SORTIERUNGEN}
            wert={sortierung}
            vorgabe="dringlichkeit"
            onWahl={(w) => setzen({ sortierung: w })}
          />
          <FilterKnopf abschnitte={filter} />
          {mitMitarbeit.length > 0 && (
            <KopfKnopf
              neu
              label="Neues To-Do"
              title="Neues To-Do – auch ohne Protokoll"
              symbol={<Icon name="plus" size={16} />}
              onClick={() => setFenster({ eintrag: null })}
            />
          )}
        </span>
      </div>
      {fenster && (
        <ToDoFenster
          ich={ich}
          modul={modul}
          gruppen={mitMitarbeit}
          mitglieder={mitglieder}
          eintrag={fenster.eintrag}
          vorlage={fenster.vorlage}
          herkunft={fenster.eintrag ? herkunftVon(fenster.eintrag) : null}
          leitungIn={leitungIn}
          onSitzung={(g, s) => {
            setFenster(null);
            onSitzung(g, s);
          }}
          onFertig={(h) => {
            setFenster(null);
            setHinweis(h);
            holen(true);
          }}
          onClose={() => setFenster(null)}
        />
      )}
      {frage && (
        <ConfirmDialog
          title="To-Do abgeben?"
          message={`Danach siehst du „${frage.e.aufgabe.text}“ nicht mehr – Mitglieder sehen nur ihre eigenen To-Dos und die, für die noch niemand zuständig ist.`}
          confirmLabel={`An ${frage.an.replace(/ \(du\)$/, '')} abgeben`}
          onConfirm={() => {
            aendern(frage.e, frage.x);
            setFrage(null);
          }}
          onCancel={() => setFrage(null)}
        />
      )}
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
      {zustand.art === 'fertig' && ansicht === 'liste' && (
        <section className={styles.karte} aria-label="To-Dos">
          {leer ??
            (!bereiche.length ? (
              <p className={styles.innen}>
                Keine To-Dos für diese Auswahl – der Filter blendet alle aus.
              </p>
            ) : (
              <ToDoZiehBereich
                zwischen={false}
                manuell={sortierung === 'manuell'}
                spalten={zieh(bereiche)}
                onAblegen={() => undefined}
                onUmordnen={umgeordnet}
                bild={bild}
              >
                {bereiche.map((b) => (
                  <div key={b.schluessel} role="group" aria-label={b.titel}>
                    <h3
                      className={
                        b.art === 'ueberfaellig'
                          ? `${styles.bereich} ${styles.rot}`
                          : styles.bereich
                      }
                    >
                      {gross(b.titel)}
                      <span className={styles.anzahl}>{b.eintraege.length}</span>
                    </h3>
                    <ZiehSpalte
                      schluessel={b.schluessel}
                      nimmtAn
                      karten={b.eintraege.map(eintragSchluessel)}
                    >
                      <ul className={styles.liste}>
                        {b.eintraege.map((e) => (
                          <ZiehKarte
                            key={eintragSchluessel(e)}
                            schluessel={eintragSchluessel(e)}
                            spalte={b.schluessel}
                            darf={sortierung === 'manuell'}
                          >
                            {inhalt(e)}
                          </ZiehKarte>
                        ))}
                      </ul>
                    </ZiehSpalte>
                  </div>
                ))}
              </ToDoZiehBereich>
            ))}
          {altSchalter}
        </section>
      )}
      {zustand.art === 'fertig' && ansicht === 'board' && (
        <>
          {leer ? (
            <section className={styles.karte} aria-label="To-Dos">
              {leer}
            </section>
          ) : (
            <ToDoZiehBereich
              zwischen
              manuell={sortierung === 'manuell'}
              spalten={zieh(boardSpalten)}
              onAblegen={abgelegt}
              onUmordnen={umgeordnet}
              bild={bild}
            >
              <section className={styles.board} aria-label="To-Dos als Board">
                {boardSpalten.map((sp) => (
                  <div
                    key={sp.schluessel}
                    className={styles.spalte}
                    role="group"
                    aria-label={sp.titel}
                  >
                    <h3 className={`${styles.spaltenKopf} ${styles[`kopf_${sp.art}`] ?? ''}`}>
                      {sp.titel}
                      {sp.art === 'erledigt' && !aeltere ? ' · 30 Tage' : ''}
                      <span className={styles.anzahl}>{sp.eintraege.length}</span>
                    </h3>
                    <ZiehSpalte
                      schluessel={sp.schluessel}
                      nimmtAn={sp.nimmtAn}
                      karten={sp.eintraege.map(eintragSchluessel)}
                      className={styles.spaltenFlaeche}
                    >
                      <ul className={styles.karten}>
                        {sp.eintraege.map((e) => (
                          <ZiehKarte
                            key={eintragSchluessel(e)}
                            schluessel={eintragSchluessel(e)}
                            spalte={sp.schluessel}
                            darf={!laeuft.has(e.aufgabe.id)}
                          >
                            {inhalt(e)}
                          </ZiehKarte>
                        ))}
                      </ul>
                    </ZiehSpalte>
                    {sp.art !== 'erledigt' && sp.art !== 'extern' && mitMitarbeit.length > 0 && (
                      <button
                        type="button"
                        className={styles.spaltenNeu}
                        onClick={() => setFenster({ eintrag: null, vorlage: vorlageFuer(sp) })}
                      >
                        <Icon name="plus" size={14} />
                        Neues To-Do
                      </button>
                    )}
                  </div>
                ))}
              </section>
            </ToDoZiehBereich>
          )}
          {altSchalter && <div className={styles.unterBoard}>{altSchalter}</div>}
        </>
      )}
    </div>
  );
}
