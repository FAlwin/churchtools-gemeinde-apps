import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { AnsichtWahl } from '@ui/bedienung/AnsichtWahl';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { eineWahl, type FilterAbschnitt } from '@ui/bedienung/filterAbschnitt';
import { useNeuAnlegen } from '@ui/bedienung/NeuAnlegen';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { gemeindeZeitzone, heuteImKalender } from '@shared/ct/zeit';
import { initialenAus, type Person } from '@shared/organigramm/mitglieder';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { ABGELEHNT_TAGE } from '@shared/protokolle/todoVorschlag';
import {
  aenderungVerboten,
  bearbeiten,
  nameImVerlauf,
  toDoRechte,
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
  schnellfilterAus,
  sichtbarFuer,
  sortieren,
  spalten,
  umordnen,
  zustaendigFuer,
  type Einteilung,
  type Sortierung,
  type Spalte,
  type ToDoEintrag,
} from '@shared/protokolle/uebersicht';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { ladeGruppenMitglieder } from './mitglieder';
import { ToDoFenster, type Herkunft } from './ToDoFenster';
import {
  TabellenKopf,
  ToDoKarte,
  ToDoZeile,
  type KartenEintrag,
  type KartenKontext,
} from './ToDoKarte';
import { toDoAendern } from './todoSchreiben';
import { todoVorschlagAblehnen, todoVorschlagZurueckziehen } from './todoVorschlagSchreiben';
import { ToDoVorschlaege, type ToDoVorschlagZeile } from './ToDoVorschlaege';
import type { VorschlagAktionen } from './Vorschlaege';
import { VorschlagAblehnen } from './VorschlagFenster';
import { ToDoZiehBereich, ZiehKarte, ZiehSpalte } from './ToDoZiehen';
import { listenForm, useKastenBreite } from './useKastenBreite';
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

/** Wonach die Liste oder das Board eingeteilt wird – steht im Filter unter „Spalten nach“ (B6, R6). */
const GRUPPIEREN: { wert: Einteilung; text: string }[] = [
  { wert: 'status', text: 'Status' },
  { wert: 'frist', text: 'Fälligkeit' },
  { wert: 'person', text: 'Person' },
];
/** Das Board hat nur Spalten, in die man ablegt – Status und Person, keine Fälligkeit. */
const GRUPPIEREN_BOARD = GRUPPIEREN.filter((o) => o.wert !== 'frist');

const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Wie lange eine eben abgehakte Karte an ihrem Platz bleibt (mit „Rückgängig“ an der Karte), bevor sie weiterrutscht. */
export const HALTEN_MS = 5000;

/** Eine eben abgehakte Karte: wie sie vorher stand (für ihren Platz) und was „Rückgängig“ ändert. */
interface Gehalten {
  vorher: Aufgabe;
  zurueck: ToDoAenderung;
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
    /** Ein To-Do-Vorschlag (W9b): übernehmen (Leitung) oder ändern (wer vorschlug). */
    modus?: 'uebernehmen' | 'aendern';
  } | null>(null);
  // Vorschlag ablehnen (W9b): das kleine Fenster mit der Begründung.
  const [ablehnen, setAblehnen] = useState<ToDoEintrag | null>(null);
  const [einst, setzen] = useToDoEinstellungen(ich.person);
  const { ansicht, nach, aus, sortierung, reihenfolge } = einst;
  const [frage, setFrage] = useState<Frage | null>(null);
  const [aeltere, setAeltere] = useState(false);
  const [laeuft, setLaeuft] = useState<ReadonlySet<string>>(new Set());
  // Bei „Jeder für sich“: bei welchen Karten „Wer ist fertig?“ aufgeklappt ist.
  const [fertigOffen, setFertigOffen] = useState<ReadonlySet<string>>(new Set());
  // Breite des Kastens – daran hängt, ob die Liste Karten oder Tabelle zeigt (Container-Abfrage in Schrift).
  const [kastenRef, kastenBreite] = useKastenBreite();
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Eben abgehakte Karten bleiben `HALTEN_MS` an ihrem Platz – mit „Rückgängig“ an der Karte selbst (W8a).
  const [gehalten, setGehalten] = useState<ReadonlyMap<string, Gehalten>>(new Map());
  const timer = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timer.current;
    return () => t.forEach((id) => clearTimeout(id));
  }, []);
  const heute = heuteImKalender();
  // Handy-Breite: zweizeilige Werkzeugzeile, Ansichtswahl als Blatt von unten (R12/E9).
  const handy = useMedienAbfrage(HANDY_BREITE);

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

  // Was selten gewechselt wird (Einteilung, Reihenfolge) und der Kurzweg „Nur meine“ stehen im Filter-Fenster (B6, R6/E15) –
  // vorher vier Umschalter-Zeilen über der Liste. „Spalten nach“ und „Reihenfolge“ sind Anzeige, nicht Filter: Sie zählen
  // nicht in die Zahl am Knopf (`eineWahl`).
  const filter: FilterAbschnitt[] = [
    eineWahl(
      ansicht === 'board' ? 'Spalten nach' : 'Gruppieren nach',
      ansicht === 'board' ? GRUPPIEREN_BOARD : GRUPPIEREN,
      ansicht === 'board' && nach === 'frist' ? 'status' : nach,
      // Die Wahl kommt aus den Möglichkeiten oben – `Einteilung` ist ihr Wertetyp.
      (w) => setzen({ nach: w as Einteilung }),
    ),
    eineWahl('Reihenfolge', SORTIERUNGEN, sortierung, (w) =>
      setzen({ sortierung: w as Sortierung }),
    ),
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
      // Der frühere Schnellfilter „Alle | Meine“ (W8b): nur ein Kurzweg auf diesen Filter – derselbe Zustand, keine zweite
      // Filterlogik (`schnellfilterAus`/`schnellfilterVon`).
      kurz: [
        { text: 'Alle', onClick: () => ausSetzen({ zustaendig: schnellfilterAus('alle') }) },
        { text: 'Nur meine', onClick: () => ausSetzen({ zustaendig: schnellfilterAus('meine') }) },
      ],
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
    // Die Rechte (`toDoRechte`) – dieselbe Regel prüft auch der Schreibweg; hier vorher, damit nichts erst gezeigt wird.
    const imEntwurf = herkunftVon(e)?.entwurf ?? false;
    const leitung = leitungIn(u.gruppe);
    const grund = aenderungVerboten(e.aufgabe, x, { ich: ich.person, leitung, imEntwurf });
    if (grund) {
      setHinweis(grund);
      beiFehler?.();
      return;
    }
    setLaeuft((s) => new Set(s).add(id));
    ersetzen(u.gruppe.id, bearbeiten(e.aufgabe, x, ich.person, new Date().toISOString()));
    toDoAendern({ modul, kategorie: u.gruppe.mitarbeit }, id, x, ich, leitung, imEntwurf)
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
    // Was ein Mitglied hier ablegen darf, sagt `toDoRechte` (nur Status eigener/geteilter, sich eintragen, abgeben).
    const grund = aenderungVerboten(e.aufgabe, x, {
      ich: ich.person,
      leitung,
      imEntwurf: herkunftVon(e)?.entwurf ?? false,
    });
    if (grund) return setHinweis(grund);
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
  // „Neues To-Do“ (R3): am Rechner/iPad grün in der Werkzeugzeile, am Handy das schwebende Plus (`useNeuAnlegen`).
  const neuKnopf = useNeuAnlegen({
    label: 'Neues To-Do',
    onClick: () => setFenster({ eintrag: null }),
    sichtbar: mitMitarbeit.length > 0,
  });

  /**
   * **Die To-Do-Vorschläge** im Bereich „Vorgeschlagen“ (W9b) – getrennt von den To-Dos (`GruppenUebersicht.todoVorschlaege`),
   * nur die Gruppen im Blick (Filter „Gruppen“). Was ich damit tun kann: Wer vorschlug, ändert und zieht zurück; die Leitung
   * der Gruppe übernimmt (öffnet das Fenster) oder lehnt ab. Danach liest die Übersicht neu – ein Vorschlag, der inzwischen
   * entschieden ist, verschwindet so von selbst.
   */
  const vorschlaege = ue
    .filter((u) => !aus.gruppen.includes(String(u.gruppe.id)))
    .flatMap((u) => u.todoVorschlaege);
  const vorschlagAktionen = (a: Aufgabe): VorschlagAktionen<ToDoVorschlagZeile> => {
    const u = ue.find((x) => x.gruppe.id === a.gruppe);
    if (!u || u.gruppe.mitarbeit === null) return {};
    const ort = { modul, kategorie: u.gruppe.mitarbeit };
    const e: ToDoEintrag = { aufgabe: a, gruppe: u.gruppe };
    const leitung = leitungIn(u.gruppe);
    return {
      aendern: () => setFenster({ eintrag: e, modus: 'aendern' }),
      zurueckziehen: async () => {
        setHinweis(null);
        try {
          await todoVorschlagZurueckziehen(ort, a.id, ich, leitung);
        } catch (f) {
          setHinweis(fehlerMeldung(f).text);
        }
        holen(true);
      },
      ...(leitung
        ? {
            uebernehmen: () => {
              setFenster({ eintrag: e, modus: 'uebernehmen' });
              return Promise.resolve();
            },
            ablehnen: () => setAblehnen(e),
          }
        : {}),
    };
  };

  /** Ein To-Do, wie es jetzt gezeigt wird (nach dem Abhaken bleibt es 5 s mit altem Platz, aber neuem Stand). */
  const eintragFuer = (e: ToDoEintrag): KartenEintrag => {
    const k = eintragSchluessel(e);
    const g = gehalten.get(k);
    // Gehalten: die Karte steht mit dem alten Stand am alten Platz, gezeigt wird der aktuelle.
    const a = (g && sichtbarGezeigt.find((x) => eintragSchluessel(x) === k)?.aufgabe) || e.aufgabe;
    const u = ue.find((x) => x.gruppe.id === e.gruppe.id);
    const liste = mitglieder.get(e.gruppe.id);
    const herkunft = herkunftVon(e);
    const rechte = toDoRechte(a, {
      ich: ich.person,
      leitung: !!u && leitungIn(u.gruppe),
      imEntwurf: herkunft?.entwurf ?? false,
    });
    return {
      e,
      a,
      herkunft,
      rechte,
      gehalten: !!g,
      darfHaken: !!u && u.gruppe.mitarbeit !== null && !g && rechte.haken,
      beschaeftigt: laeuft.has(a.id),
      gruppeGroesse: Array.isArray(liste) ? liste.length : undefined,
    };
  };
  /** Was für alle Karten gleich ist. */
  const kx: KartenKontext = {
    ich,
    heute,
    personen: bekannte,
    namen,
    mehrereGruppen,
    fertigOffen,
    onFertig: (k) =>
      setFertigOffen((s) => {
        const n = new Set(s);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      }),
    onOeffnen: (e) => setFenster({ eintrag: e }),
    onHaken: haken,
    onMache: (e) => aendern(e, { wer: [ich.person] }),
    onRueckgaengig: (e) => {
      const k = eintragSchluessel(e);
      const g = gehalten.get(k);
      if (!g) return;
      loslassen(k);
      aendern(e, g.zurueck);
    },
    onSitzung,
  };
  const form = listenForm(kastenBreite);
  const tabelle = form !== 'karten';
  const mitGruppe = form === 'tabelle' && mehrereGruppen;

  const zieh = (l: readonly { schluessel: string; eintraege: ToDoEintrag[] }[]) =>
    new Map(l.map((b) => [b.schluessel, b.eintraege.map(eintragSchluessel)]));
  const bild = (karte: string): ReactNode => {
    const e = gezeigt.find((x) => eintragSchluessel(x) === karte);
    return e ? (
      <ul className={styles.liste}>
        <li className={styles.zeile}>
          <ToDoKarte k={eintragFuer(e)} kx={kx} imBoard />
        </li>
      </ul>
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
      <Werkzeugzeile
        handy={handy}
        ariaLabel="To-Dos"
        links={
          <AnsichtWahl
            value={ansicht}
            options={[
              { value: 'liste', label: 'Liste' },
              { value: 'board', label: 'Board' },
            ]}
            onChange={(a) => setzen({ ansicht: a })}
            handy={handy}
          />
        }
        rechts={
          <>
            <FilterKnopf still abschnitte={filter} />
            {neuKnopf.kopf}
          </>
        }
      />
      {neuKnopf.schwebend}
      {fenster && (
        <ToDoFenster
          ich={ich}
          modul={modul}
          gruppen={mitMitarbeit}
          mitglieder={mitglieder}
          eintrag={fenster.eintrag}
          vorlage={fenster.vorlage}
          modus={fenster.modus}
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
      {ablehnen?.aufgabe.vorschlag && (
        <VorschlagAblehnen
          vorschlag={{ titel: ablehnen.aufgabe.text, name: ablehnen.aufgabe.vorschlag.name }}
          sieht={`sieht ${ablehnen.aufgabe.vorschlag.name.split(' ')[0]} ${ABGELEHNT_TAGE} Tage lang`}
          onAblehnen={async (grund) => {
            const g = ue.find((u) => u.gruppe.id === ablehnen.gruppe.id)?.gruppe;
            if (!g || g.mitarbeit === null) return;
            try {
              await todoVorschlagAblehnen(
                { modul, kategorie: g.mitarbeit },
                ablehnen.aufgabe.id,
                grund,
                ich,
                leitungIn(g),
              );
            } finally {
              // Auch bei einer Verweigerung (inzwischen entschieden) neu lesen – dann stimmt die Anzeige wieder.
              holen(true);
            }
            setAblehnen(null);
          }}
          onClose={() => setAblehnen(null)}
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
      {zustand.art === 'fertig' && (
        <ToDoVorschlaege
          ich={ich.person}
          liste={vorschlaege}
          leitungIn={(g) => {
            const x = ue.find((u) => u.gruppe.id === g);
            return !!x && leitungIn(x.gruppe);
          }}
          irgendwoLeitung={irgendwoLeitung}
          heute={heute}
          zeitzone={gemeindeZeitzone()}
          aktionen={vorschlagAktionen}
        />
      )}
      {zustand.art === 'fertig' && ansicht === 'liste' && (
        <section ref={kastenRef} className={styles.karte} aria-label="To-Dos">
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
                {tabelle && <TabellenKopf mitGruppe={mitGruppe} />}
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
                            {tabelle ? (
                              <ToDoZeile k={eintragFuer(e)} kx={kx} mitGruppe={mitGruppe} />
                            ) : (
                              <ToDoKarte k={eintragFuer(e)} kx={kx} />
                            )}
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
                            <ToDoKarte k={eintragFuer(e)} kx={kx} imBoard spalteArt={sp.art} />
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
