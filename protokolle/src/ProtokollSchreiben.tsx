import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { ApiError } from '@ui/ct/fehler';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { ableiten, fremdeTypen, type Block } from '@shared/protokolle/dokument';
import {
  sperreLage,
  type ProtokollKopf,
  type ProtokollTeil,
  type Schreiber,
} from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  aufgabenAbgleich,
  nameAusListe,
  neueAufgabe,
  statusSetzen,
  type Aufgabe,
  type AufgabenStatus,
} from '@shared/protokolle/aufgaben';
import type { Person } from '@shared/organigramm/mitglieder';
import { gemeindeZeitzone, heuteImKalender } from '@shared/ct/zeit';
import {
  aufsNaechsteMal,
  ablehnen,
  einfuegeStelle,
  imProtokoll,
  istVorschlag,
  offeneFuer,
  schonImDokument,
  vorschlagBloecke,
  zumEinfuegen,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import { istAufgabe } from '@shared/protokolle/aufgaben';
import { AufgabenKontext, type AufgabenKontextWert } from './aufgabenKontext';
import {
  aufgabeAendern,
  aufgabenSchreiben,
  aufgabenWerte,
  type MitarbeitOrt,
} from './aufgabenSchreiben';
import { derArt, mitarbeitRoh } from './mitarbeitWerte';
import { vorschlagSchreiben } from './vorschlaegeSchreiben';
import { VorschlaegeKasten } from './Vorschlaege';
import { VorschlagAblehnen } from './VorschlagFenster';
import vorschlagStil from './Vorschlaege.module.scss';
import { ladeGruppenMitglieder } from './mitglieder';
import { uhrzeit, wannLang } from './anzeige';
import { Bereiche } from './Bereiche';
import { DokumentEditor, type EditorGriff } from './DokumentEditor';
import { EDITOR_TYPEN } from './editorSchema';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import { Marke } from './Marke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import {
  freigeben,
  protokollLesen,
  schreibenUebernehmen,
  speichern,
  sperreFreigeben,
  sperreNehmen,
  treffenVerknuepfen,
  type ProtokollOrt,
} from './schreiben';
import { treffenAnlegen } from './planen';
import { anwesenheitLesen, treffenAbschliessen } from './anwesenheitSchreiben';
import { FreigabeFenster, type FreigabeFolge } from './FreigabeFenster';
import { ZurueckVermerk } from './FreigabeVermerk';
import { festhaltenFuerFreigabe } from '@shared/protokolle/festePunkte';
import { freigabeHinweise, type Hinweis } from '@shared/protokolle/freigabe';
import { freigabeBeitrag, type Beitrag } from '@shared/protokolle/beitrag';
import { ctBasis } from '@ui/ct/verbindung';
import { modulPort } from '@ui/ct/modulPort';
import { beitragMoeglich, beitragSchritt } from './beitragSchreiben';
import { sitzungsLink } from './reiter';
import type { TreffenStand } from '@shared/protokolle/anwesenheit';
import { SchreibSteuerung, type SteuerZustand } from './schreibSteuerung';
import ansicht from './SitzungAnsicht.module.scss';
import styles from './ProtokollSchreiben.module.scss';

/** So oft liest mit, wer gerade nicht schreiben kann. */
export const MITLESEN_MS = 30_000;

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  /** Kein Entwurf (mehr) oder Blöcke, die dieser Editor nicht kennt – nur lesen. */
  | { art: 'lesen'; dokument: Block[] | null; grund: string }
  | { art: 'bereit'; kopf: ProtokollKopf; dokument: Block[] };

/**
 * **Ein Protokoll schreiben** (Bauplan S4-1, Entwurf 7) – für die Leitung bei einem Protokoll im Entwurf. Oben Titel und
 * Speicherstand, darunter Werkzeugleiste, Blatt und die Bereiche (live aus dem Text).
 *
 * Entschieden 24.10.2026 (Alwin): automatisch speichern; die Sperre entsteht mit der ersten Änderung (wer nur
 * reinschaut, blockiert niemanden); schreibt jemand anderes, liest man mit (alle `MITLESEN_MS`) und kann das Schreiben
 * mit Rückfrage übernehmen – auch von sich selbst in einem anderen Fenster.
 *
 * S4-2: Aufgaben im Text sind To-Dos in „Mitarbeit“. Beim Speichern gleicht `aufgabenAbgleich` sie ab (das Protokoll
 * führt); Wer, Bis und Status ändern die Schildchen direkt am To-Do (`aufgabeAendern`).
 *
 * S4-3a: feste Punkte („Offene To-Dos“, „Letztes Protokoll“) über `FestePunkteRahmen`; der Umschalter **„Lesen“**
 * zeigt dasselbe Protokoll als Lese-Ansicht (Alwin 26.10.2026) – ohne Sperre, der Editor bleibt dahinter bestehen.
 */
export function ProtokollSchreiben({
  sitzung,
  gruppe,
  gruppeId,
  modul,
  kategorie,
  mitarbeit,
  protokolle,
  teile,
  ich,
  zeitzone,
  naechste,
  kommend = [],
  direkt = false,
  vollerName = ich.name,
  onVorschlag,
  onBearbeiten,
  onFreigegeben,
  onZurueck,
  onZuSitzung,
}: {
  sitzung: Sitzung;
  gruppe: string;
  gruppeId: number;
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  /** Kategorie „Mitarbeit“ (To-Dos) – `null`, wenn die Gruppe unvollständig eingerichtet ist (dann keine To-Dos). */
  mitarbeit: number | null;
  /** Die freigegebenen Protokolle der Gruppe und alle Teile – für „Letztes Protokoll“ (S4-3a). */
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  ich: Omit<Schreiber, 'fenster'>;
  zeitzone: string;
  /** „Nächste Sitzung“ im Bereich Termine (S5-2) – festgelegt wird im Fenster der Liste dahinter. */
  naechste?: ReactNode;
  /** Die kommenden Sitzungen der Gruppe – wofür ein Vorschlag gerade gilt (S5-4, `zielSitzung`). */
  kommend?: readonly Sitzung[];
  /** Gruppe „Direkt eintragen“: offene Vorschläge kommen beim Öffnen von selbst hinein (S5-4). */
  direkt?: boolean;
  /** Vor- und Nachname für den Verlauf der Vorschläge. */
  vollerName?: string;
  /** Ein Vorschlag hat sich hier geändert – die Liste dahinter zieht mit. */
  onVorschlag?: (v: Vorschlag) => void;
  /** „Bearbeiten“ im Kopf – die Sitzung dieses Protokolls (Zeit, Titel, Eingeladene, absagen; K2b), nur für die Leitung. */
  onBearbeiten?: () => void;
  /** Freigegeben (S6-1) – die Liste dahinter lädt neu und zeigt das Protokoll zum Lesen. */
  onFreigegeben?: () => void;
  /** `geaendert` = es wurde gespeichert; die Liste dahinter lädt dann neu. */
  onZurueck: (geaendert: boolean) => void;
  /**
   * „Öffnen“ im Fenster eines früheren Protokolls (K3b-2): erst speichern und die Sperre lösen – wie „Zurück“ –, dann
   * dorthin. `geaendert` wie bei `onZurueck`.
   */
  onZuSitzung?: (s: Sitzung, geaendert: boolean) => void;
}) {
  // Ort und Schreiber bleiben für die Lebenszeit des Editors gleich – hinge „Öffnen“ an einem Objekt, das bei jedem
  // Neuzeichnen der Liste neu entsteht, lüde der Editor mitten im Tippen neu (beim Durchklicken 24.10.2026 gefunden).
  const sitzungId = sitzung.kopf?.sitzung ?? '';
  const ort = useMemo<ProtokollOrt>(
    () => ({ modul, kategorie, sitzung: sitzungId }),
    [modul, kategorie, sitzungId],
  );
  const [schreiber] = useState<Schreiber>(() => ({ ...ich, fenster: crypto.randomUUID() }));
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [z, setZ] = useState<SteuerZustand | null>(null);
  const [dok, setDok] = useState<Block[]>([]);
  const [frage, setFrage] = useState<'uebernehmen' | 'verlassen' | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [lesen, setLesen] = useState(false);
  const steuerung = useRef<SchreibSteuerung | null>(null);
  const editor = useRef<EditorGriff | null>(null);
  const gespeichert = useRef(false);
  const mOrt = useMemo<MitarbeitOrt | null>(
    () => (mitarbeit === null ? null : { modul, kategorie: mitarbeit }),
    [modul, mitarbeit],
  );
  // Alle To-Dos der Gruppe (auch gelöschte) – im Ref für die Rückrufe des Editors, im Zustand für die Anzeige.
  const [todos, setTodosZustand] = useState<ReadonlyMap<string, Aufgabe>>(new Map());
  const todosRef = useRef(todos);
  const setTodos = useCallback((liste: readonly Aufgabe[] | ReadonlyMap<string, Aufgabe>) => {
    const m = liste instanceof Map ? liste : new Map((liste as Aufgabe[]).map((a) => [a.id, a]));
    todosRef.current = m;
    setTodosZustand(m);
  }, []);
  // Änderungen an To-Dos nacheinander – zwei schnelle Klicks dürfen sich nicht gegenseitig überschreiben.
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  // Vorschläge der Gruppe (S5-4) – frisch gelesen beim Öffnen, mit den To-Dos in einem Lesen.
  const [vorschlaege, setVorschlaege] = useState<readonly Vorschlag[]>([]);
  const [vorschlagHinweis, setVorschlagHinweis] = useState<string | null>(null);
  const [vorschlagFehler, setVorschlagFehler] = useState<string | null>(null);
  const [ablehnenFuer, setAblehnenFuer] = useState<Vorschlag | null>(null);
  // Je Öffnen wird einmal eingefügt, was hinein soll – nicht bei jedem Neuzeichnen.
  const eingefuegt = useRef(false);

  // To-Dos vor dem Schreiben abgleichen (S4-2) – beim Speichern und beim Freigeben (S6-1) derselbe Weg.
  const abgleich = useCallback(
    (d: readonly Block[]) =>
      mOrt
        ? async () =>
            setTodos(
              await aufgabenSchreiben(
                mOrt,
                (vorhanden) =>
                  aufgabenAbgleich({
                    eintraege: ableiten(d).aufgaben,
                    vorhanden,
                    gruppe: gruppeId,
                    sitzung: ort.sitzung,
                    von: schreiber.person,
                    am: new Date().toISOString(),
                  }),
                schreiber,
              ),
            )
        : undefined,
    [mOrt, gruppeId, ort.sitzung, schreiber, setTodos],
  );

  const oeffnen = useCallback(() => {
    setLaden({ art: 'laedt' });
    eingefuegt.current = false;
    Promise.all([protokollLesen(ort), mOrt ? mitarbeitRoh(mOrt) : Promise.resolve([])]).then(
      ([{ kopf, dokument }, roh]) => {
        setTodos(derArt(roh, istAufgabe).map((w) => w.x));
        setVorschlaege(derArt(roh, istVorschlag).map((w) => w.x));
        if (!kopf || !dokument) {
          setLaden({
            art: 'lesen',
            dokument,
            grund: !kopf
              ? 'Dieses Protokoll gibt es nicht mehr.'
              : 'Das Protokoll ist gerade nicht vollständig lesbar. Bitte gleich noch einmal öffnen.',
          });
          return;
        }
        if (kopf.status !== 'entwurf') {
          setLaden({
            art: 'lesen',
            dokument,
            grund: 'Das Protokoll ist freigegeben und lässt sich nicht mehr ändern.',
          });
          return;
        }
        const fremd = fremdeTypen(dokument, EDITOR_TYPEN);
        if (fremd.length) {
          setLaden({
            art: 'lesen',
            dokument,
            grund: `Das Protokoll enthält Inhalte, die diese Fassung der Erweiterung noch nicht bearbeiten kann (${fremd.join(', ')}). Es wird nur angezeigt, damit nichts verloren geht.`,
          });
          return;
        }
        const s = new SchreibSteuerung(
          {
            sperreNehmen: (stand) => sperreNehmen(ort, schreiber, stand),
            speichern: (stand, d) => speichern(ort, schreiber, stand, d, new Date(), abgleich(d)),
            dokument: () => editor.current?.dokument() ?? dokument,
            jetzt: () => new Date(),
          },
          kopf,
          sperreLage(kopf.sperre, schreiber, new Date()) === 'fremd' ? 'gesperrt' : 'frei',
          kopf.sperre,
        );
        steuerung.current?.stoppen();
        steuerung.current = s;
        setZ(s.zustand);
        s.abonnieren((neu) => {
          setZ(neu);
          if (neu.zuletzt) gespeichert.current = true;
        });
        setDok(dokument);
        setLaden({ art: 'bereit', kopf, dokument });
      },
      (e: unknown) => setLaden({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [ort, schreiber, mOrt, setTodos, abgleich]);

  useEffect(oeffnen, [oeffnen]);

  // Wer eine Aufgabe übernehmen kann – einmal je Editor; ein Fehler lässt die Liste leer („werden geladen“ bleibt nicht
  // stehen: dann gibt es nur den externen Namen, und der Hinweis sagt es).
  const mitgliederStand = useLaden(() => ladeGruppenMitglieder(gruppeId), [gruppeId]).stand;
  const mitglieder: readonly Person[] | 'verborgen' | null =
    mitgliederStand.art === 'fertig'
      ? mitgliederStand.daten
      : mitgliederStand.art === 'fehler'
        ? 'verborgen'
        : null;

  const todoAendern = useCallback(
    (id: string, text: string, f: (a: Aufgabe) => Aufgabe) => {
      if (!mOrt) return;
      const anlegen = () =>
        neueAufgabe({
          id,
          gruppe: gruppeId,
          sitzung: ort.sitzung,
          text,
          von: schreiber.person,
          am: new Date().toISOString(),
        });
      // Gleich zeigen, dann schreiben; das Ergebnis aus ChurchTools gilt.
      const vorher = todosRef.current;
      setTodos(new Map(vorher).set(id, f(vorher.get(id) ?? anlegen())));
      kette.current = kette.current
        .catch(() => undefined)
        .then(() => aufgabeAendern(mOrt, id, f, anlegen, schreiber))
        .then(
          (a) => setTodos(new Map(todosRef.current).set(id, a)),
          (e: unknown) => {
            setHinweis(`To-Do nicht gespeichert: ${fehlerMeldung(e).text}`);
            void aufgabenWerte(mOrt).then(
              (w) => setTodos(w.map((x) => x.aufgabe)),
              () => undefined,
            );
          },
        );
    },
    [mOrt, gruppeId, ort.sitzung, schreiber, setTodos],
  );

  const fremdeAufgabe = useCallback(
    (id: string) => {
      const a = todosRef.current.get(id);
      return !!a && a.sitzung !== ort.sitzung;
    },
    [ort.sitzung],
  );

  // Feste Punkte (S4-3a): Abhaken in „Offene To-Dos“ ändert das To-Do wie der Kreis an der Aufgabe.
  const statusFest = useCallback(
    (a: Aufgabe, neu: AufgabenStatus) =>
      todoAendern(a.id, a.text, (x) =>
        statusSetzen(x, neu, schreiber.person, new Date().toISOString()),
      ),
    [todoAendern, schreiber.person],
  );
  // Sich selbst kennt man auch, wenn die Mitgliederliste verborgen ist (S7-2a).
  const nameVon = useMemo(() => nameAusListe(mitglieder, schreiber), [mitglieder, schreiber]);

  // Beim Verlassen der Seite (anderer Reiter, ChurchTools-Menü): noch speichern und die Sperre freigeben – ohne zu
  // warten. Klappt es nicht, verfällt die Sperre nach `SPERRE_MINUTEN`.
  useEffect(
    () => () => {
      const s = steuerung.current;
      if (!s || s.zustand.lage !== 'schreibe') return;
      void s
        .jetzt()
        .then(() => sperreFreigeben(ort, schreiber))
        .catch(() => undefined);
    },
    [ort, schreiber],
  );

  // Fenster schließen mit Ungespeichertem: der Browser fragt nach.
  useEffect(() => {
    if (!z?.offen && !z?.speichert) return;
    const warnen = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [z?.offen, z?.speichert]);

  // Mitlesen, solange jemand anderes schreibt.
  useEffect(() => {
    if (z?.lage !== 'gesperrt') return;
    const t = setInterval(() => {
      const s = steuerung.current;
      if (!s) return;
      protokollLesen(ort).then(
        ({ kopf, dokument }) => {
          if (!kopf || kopf.status !== 'entwurf') return oeffnen();
          // Eigene ungespeicherte Änderungen nicht überschreiben – die Person soll sie noch kopieren können; weiter geht
          // es dann bewusst mit „Schreiben übernehmen“.
          if (s.zustand.offen) return;
          if (dokument && kopf.stand !== s.basisStand) {
            editor.current?.ersetzen(dokument);
            setDok(dokument);
          }
          const frei = sperreLage(kopf.sperre, schreiber, new Date()) !== 'fremd';
          s.neuAufsetzen(kopf, frei ? 'frei' : 'gesperrt', frei ? null : kopf.sperre);
          if (frei) setHinweis('Niemand schreibt mehr – du kannst jetzt schreiben.');
        },
        () => undefined,
      ); // Mitlesen ist Beiwerk: beim nächsten Mal wieder
    }, MITLESEN_MS);
    return () => clearInterval(t);
  }, [z?.lage, ort, schreiber, oeffnen]);

  const uebernehmen = () => {
    setBeschaeftigt(true);
    schreibenUebernehmen(ort, schreiber).then(
      (r) => {
        setBeschaeftigt(false);
        setFrage(null);
        if (r.art !== 'ok') {
          setHinweis(
            r.art === 'gesperrt'
              ? `Das hat nicht geklappt – ${r.sperre.name} hat gerade wieder gespeichert. Bitte noch einmal versuchen.`
              : 'Das Protokoll lässt sich nicht mehr bearbeiten.',
          );
          if (r.art !== 'gesperrt') oeffnen();
          return;
        }
        editor.current?.ersetzen(r.dokument);
        setDok(r.dokument);
        steuerung.current?.neuAufsetzen(r.kopf, 'schreibe');
        setHinweis(null);
      },
      (e: unknown) => {
        setBeschaeftigt(false);
        setFrage(null);
        setHinweis(fehlerMeldung(e).text);
      },
    );
  };

  // Wohin „Zurück“ führt: `null` = zur Liste, sonst zu einem früheren Protokoll („Öffnen“, K3b-2). Gemerkt, weil die
  // Frage „Trotzdem verlassen?“ dazwischenkommen kann.
  const ziel = useRef<Sitzung | null>(null);
  const zurueck = async (trotzdem = false) => {
    const s = steuerung.current;
    if (s && s.zustand.lage === 'schreibe' && !trotzdem) {
      setBeschaeftigt(true);
      const fertig = await s.jetzt();
      setBeschaeftigt(false);
      if (!fertig) {
        setFrage('verlassen');
        return;
      }
    }
    s?.stoppen();
    if (s?.zustand.lage === 'schreibe') void sperreFreigeben(ort, schreiber).catch(() => undefined);
    steuerung.current = null;
    if (ziel.current && onZuSitzung) onZuSitzung(ziel.current, gespeichert.current);
    else onZurueck(gespeichert.current);
  };

  const neuLaden = () => {
    setHinweis(null);
    oeffnen();
  };

  const aufgaben = useMemo(() => [...todos.values()].filter((a) => !a.geloescht), [todos]);

  // „Gruppentreffen anlegen“ im festen Punkt „Anwesenheit“ (S5-3): anlegen (ohne Mail), mit dem Protokoll verknüpfen.
  // Im Editor angelegtes Treffen (S5-3) – für die Hinweise vor dem Freigeben (S6-1), bevor die Liste neu lädt.
  const neuesTreffenId = useRef<number | null>(null);
  const neuesTreffen = useCallback(async () => {
    const id = await treffenAnlegen(
      gruppeId,
      sitzung.beginn,
      sitzung.ende ?? sitzung.beginn,
      zeitzone,
    );
    await treffenVerknuepfen(ort, id);
    neuesTreffenId.current = id;
    return id;
  }, [gruppeId, sitzung.beginn, sitzung.ende, zeitzone, ort]);

  // Vorschläge (S5-4): wer schreibt (mit vollem Namen), heute, und ein Vorschlag nach dem Schreiben in beide Listen.
  const ichV = useMemo(
    () => ({ person: schreiber.person, name: vollerName }),
    [schreiber.person, vollerName],
  );
  const vorschlagNeu = useCallback(
    (v: Vorschlag) => {
      setVorschlaege((l) => l.map((x) => (x.id === v.id ? v : x)));
      onVorschlag?.(v);
    },
    [onVorschlag],
  );

  /**
   * **Vorschläge ins Protokoll** (S5-4): Punkte vor „Verschiedenes“ einfügen (was schon drinsteht – Block-ID
   * `vorschlag-…` – nicht noch einmal), **sofort speichern** und erst danach „im Protokoll“ vermerken. Scheitert das
   * Speichern, bleibt der Vorschlag, wie er war: Beim nächsten Öffnen wird er erkannt und nur noch vermerkt. Liefert, wie
   * viele neu hineinkamen und ob vor „Verschiedenes“.
   */
  const insProtokoll = useCallback(
    async (liste: readonly Vorschlag[]): Promise<{ neu: number; vorVerschiedenes: boolean }> => {
      const g = editor.current;
      const st = steuerung.current;
      if (!g || !st || !mOrt || !liste.length) return { neu: 0, vorVerschiedenes: false };
      const neu = liste.filter((v) => !schonImDokument(g.dokument(), v));
      const vorVerschiedenes = einfuegeStelle(g.dokument()) !== null;
      for (const v of neu) g.einfuegen(vorschlagBloecke(v), einfuegeStelle(g.dokument()));
      if (neu.length) {
        st.geaendert();
        if (!(await st.jetzt()))
          // 409: `fehlerMeldung` zeigt diesen Text statt „ChurchTools antwortet gerade nicht“.
          throw new ApiError(
            409,
            'Das Protokoll ist noch nicht gespeichert – der Vorschlag steht schon drin und wird beim nächsten Öffnen vermerkt.',
          );
      }
      for (const v of liste)
        vorschlagNeu(
          await vorschlagSchreiben(mOrt, v.id, (x) =>
            imProtokoll(x, ort.sitzung, ichV, new Date().toISOString()),
          ),
        );
      return { neu: neu.length, vorVerschiedenes };
    },
    [mOrt, ort.sitzung, ichV, vorschlagNeu],
  );

  // Beim Öffnen: angenommene Vorschläge dieser Sitzung – und bei „Direkt eintragen“ auch die offenen – einfügen. Nur,
  // wenn dieses Fenster schreiben darf (niemand sonst schreibt); einmal je Öffnen.
  const lageJetzt = z?.lage;
  useEffect(() => {
    if (laden.art !== 'bereit' || (lageJetzt !== 'frei' && lageJetzt !== 'schreibe')) return;
    if (eingefuegt.current) return;
    eingefuegt.current = true;
    const zone = gemeindeZeitzone();
    const liste = zumEinfuegen(
      vorschlaege,
      sitzung,
      direkt,
      kommend,
      heuteImKalender(new Date(), zone),
      zone,
    );
    if (!liste.length) return;
    insProtokoll(liste).then(
      (r) => {
        if (r.neu)
          setVorschlagHinweis(
            `${r.neu === 1 ? 'Ein Vorschlag wurde' : `${r.neu} Vorschläge wurden`} als Punkt ${r.vorVerschiedenes ? 'vor „Verschiedenes“' : 'am Ende'} eingefügt.`,
          );
      },
      (e: unknown) => setVorschlagFehler(`Vorschläge: ${fehlerMeldung(e).text}`),
    );
  }, [laden.art, lageJetzt, vorschlaege, sitzung, direkt, kommend, insProtokoll]);

  const vorschlagTun = (f: () => Promise<unknown>) => async () => {
    setVorschlagFehler(null);
    try {
      await f();
    } catch (e) {
      setVorschlagFehler(fehlerMeldung(e).text);
    }
  };
  const zone = gemeindeZeitzone();
  const offeneVorschlaege = direkt
    ? []
    : offeneFuer(vorschlaege, sitzung, kommend, heuteImKalender(new Date(), zone), zone);

  // Freigeben (S6-1): Hinweise im Fenster – die Anwesenheit kommt frisch aus ChurchTools nach. Ob ein Beitrag in der
  // Gruppe geht (S6-2), ebenso; bis beides da ist, wartet „Freigeben“.
  const [freigabe, setFreigabe] = useState<{
    laedtAnwesenheit: boolean;
    laedtBeitrag: boolean;
    hinweise: Hinweis[];
    zusammenfassung: string;
    treffen: number | null;
    beitrag: Beitrag | null;
  } | null>(null);
  const freigabeOeffnen = () => {
    const d = editor.current?.dokument() ?? dok;
    const treffen =
      neuesTreffenId.current ??
      (laden.art === 'bereit' ? laden.kopf.treffen : null) ??
      sitzung.treffen;
    const mit = (anwesenheit: TreffenStand | null) =>
      freigabeHinweise({
        dokument: d,
        aufgaben: todosRef.current,
        anwesenheit,
        offeneVorschlaege,
      });
    setFreigabe({
      laedtAnwesenheit: treffen !== null,
      laedtBeitrag: true,
      treffen,
      beitrag: null,
      ...mit(null),
    });
    if (treffen !== null)
      anwesenheitLesen(gruppeId, treffen).then(
        (a) => setFreigabe((f) => f && { ...f, laedtAnwesenheit: false, ...mit(a) }),
        // Lesen gescheitert: ohne Anwesenheits-Hinweis weiter – Freigeben bleibt möglich.
        () => setFreigabe((f) => f && { ...f, laedtAnwesenheit: false }),
      );
    const beitrag = freigabeBeitrag({
      titel: laden.art === 'bereit' ? laden.kopf.titel : sitzung.titel,
      beginn: sitzung.beginn,
      zeitzone,
      link: sitzungsLink(ctBasis(), modulPort.kuerzel() ?? 'protokolle', gruppeId, ort.sitzung),
    });
    beitragMoeglich(gruppeId).then(
      (ja) => setFreigabe((f) => f && { ...f, laedtBeitrag: false, beitrag: ja ? beitrag : null }),
      // Nicht feststellbar: ohne Häkchen weiter – Freigeben bleibt möglich, der Beitrag ist Beiwerk.
      () => setFreigabe((f) => f && { ...f, laedtBeitrag: false }),
    );
  };
  const freigebenJetzt = async (bescheid: boolean): Promise<FreigabeFolge> => {
    const st = steuerung.current;
    if (!st || !(await st.jetzt()))
      throw new ApiError(
        409,
        'Die letzten Änderungen sind noch nicht gespeichert – bitte gleich noch einmal versuchen.',
      );
    const d = festhaltenFuerFreigabe(editor.current?.dokument() ?? dok, {
      aufgaben: [...todosRef.current.values()],
      gruppe: gruppeId,
      sitzung: { beginn: sitzung.beginn, kopf: { sitzung: ort.sitzung, status: 'entwurf' } },
      protokolle,
      heute: heuteImKalender(new Date(), zone),
    });
    const r = await freigeben(ort, schreiber, st.basisStand, d, ichV, new Date(), abgleich(d));
    if (r.art !== 'ok')
      throw new ApiError(
        409,
        r.art === 'gesperrt'
          ? `${r.sperre.name} schreibt gerade – freigeben geht erst danach.`
          : r.art === 'veraendert'
            ? 'Inzwischen hat jemand anderes gespeichert – bitte den aktuellen Stand laden.'
            : r.art === 'fest'
              ? 'Das Protokoll ist schon freigegeben.'
              : 'Dieses Protokoll gibt es nicht mehr.',
      );
    // Frei: dieses Fenster schreibt nicht mehr (und gibt beim Schließen keine Sperre frei).
    st.stoppen();
    steuerung.current = null;
    gespeichert.current = true;
    const t = r.kopf.treffen;
    const b = bescheid ? freigabe?.beitrag : null;
    return {
      ...(t !== null ? { treffen: () => treffenAbschliessen(gruppeId, t) } : {}),
      ...(b ? { beitrag: beitragSchritt(gruppeId, b) } : {}),
    };
  };
  const zurStelle = (ziel: string) => {
    setFreigabe(null);
    setLesen(false);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-id="${CSS.escape(ziel)}"]`)
        ?.scrollIntoView?.({ block: 'center' });
    });
  };

  // Feste Punkte (S4-3a) – derselbe Rahmen für Editor, Lese-Ansicht und „nur lesen“.
  const rahmen = (inhalt: ReactNode) => (
    <FestePunkteRahmen
      sitzung={sitzung}
      gruppe={gruppeId}
      protokolle={protokolle}
      teile={teile}
      aufgaben={aufgaben}
      zeitzone={zeitzone}
      name={nameVon}
      status={mOrt ? statusFest : undefined}
      onTreffenAnlegen={neuesTreffen}
      onZuSitzung={
        onZuSitzung
          ? (s) => {
              ziel.current = s;
              void zurueck();
            }
          : undefined
      }
    >
      {inhalt}
    </FestePunkteRahmen>
  );

  // Freigeben darf, wer hier gerade schreiben kann (niemand sonst schreibt) – im Editor ist das immer die Leitung.
  const darfFreigeben = laden.art === 'bereit' && (z?.lage === 'frei' || z?.lage === 'schreibe');

  const kopfZeile = (
    <>
      <button
        type="button"
        className={ansicht.zurueck}
        onClick={() => {
          ziel.current = null; // „Zurück“ führt immer zur Liste – auch nach einem abgebrochenen „Öffnen“
          void zurueck();
        }}
        disabled={beschaeftigt}
      >
        <Icon name="chev-left" size={18} />
        Sitzungen
      </button>
      <header className={ansicht.kopf}>
        <h2>
          {sitzung.titel} · {gruppe}
        </h2>
        <p>{wannLang(sitzung.beginn, zeitzone)}</p>
        <div className={ansicht.marken}>
          <Marke art="leise">Entwurf – noch nicht freigegeben</Marke>
          {z && <SpeicherStand z={z} zeitzone={zeitzone} />}
        </div>
        {(onBearbeiten || darfFreigeben) && (
          <div className={ansicht.aktionen}>
            {darfFreigeben && (
              <KopfKnopf
                haupt
                label="Freigeben"
                title="Protokoll freigeben"
                symbol={<Icon name="stempel" size={16} />}
                onClick={freigabeOeffnen}
              />
            )}
            {onBearbeiten && (
              <KopfKnopf
                label="Bearbeiten"
                title="Sitzung bearbeiten (Zeit, Titel, Eingeladene, absagen)"
                symbol={<Icon name="pencil" size={16} />}
                onClick={onBearbeiten}
              />
            )}
          </div>
        )}
      </header>
      <ZurueckVermerk kopf={laden.art === 'bereit' ? laden.kopf : null} zeitzone={zeitzone} />
    </>
  );

  if (laden.art === 'laedt')
    return (
      <div className={ansicht.seite}>
        {kopfZeile}
        <p className={ansicht.hinweis}>Wird geladen …</p>
      </div>
    );
  if (laden.art === 'fehler')
    return (
      <div className={ansicht.seite}>
        {kopfZeile}
        <FehlerKasten fehler={laden.fehler} onNochmal={oeffnen} />
      </div>
    );
  if (laden.art === 'lesen')
    return (
      <div className={ansicht.seite}>
        {kopfZeile}
        <p className={ansicht.hinweis}>{laden.grund}</p>
        {laden.dokument &&
          rahmen(
            <>
              <section className={ansicht.karte} aria-label="Protokoll">
                <ProtokollAnsicht dokument={laden.dokument} aufgaben={aufgaben} />
              </section>
              <Bereiche dokument={laden.dokument} aufgaben={aufgaben} naechste={naechste} />
            </>,
          )}
      </div>
    );

  const lage = z?.lage ?? 'frei';
  const bearbeitbar = lage === 'frei' || lage === 'schreibe';
  const kontext: AufgabenKontextWert | null = mOrt
    ? {
        todos,
        mitglieder,
        bearbeitbar,
        statusAenderbar: true,
        ich: schreiber,
        aendern: todoAendern,
      }
    : null;
  const sperre = z?.sperre ?? null;
  const ichSelbst = sperre?.von === schreiber.person;

  return (
    <div className={ansicht.seite}>
      {kopfZeile}
      <Segment
        className={styles.umschalter}
        value={lesen ? 'lesen' : 'schreiben'}
        options={[
          { value: 'schreiben', label: 'Schreiben' },
          { value: 'lesen', label: 'Lesen' },
        ]}
        onChange={(v) => {
          setLesen(v === 'lesen');
          // Erst speichern, dann lesen – die Lese-Ansicht zeigt den Stand, den auch alle anderen sehen.
          const s = steuerung.current;
          if (v === 'lesen' && s?.zustand.lage === 'schreibe') void s.jetzt();
        }}
        ariaLabel="Ansicht"
        verbunden
      />

      {lage === 'gesperrt' && sperre && (
        <div className={styles.hinweis} role="status">
          <Icon name="lock" size={18} />
          <div>
            <b>
              {ichSelbst
                ? 'Du schreibst gerade in einem anderen Fenster oder auf einem anderen Gerät.'
                : `${sperre.name} schreibt gerade.`}
            </b>{' '}
            Zuletzt gespeichert um {uhrzeit(sperre.seit, zeitzone)}. Du siehst den gespeicherten
            Stand – er aktualisiert sich alle {MITLESEN_MS / 1000} Sekunden.
            {z?.offen && (
              <>
                {' '}
                Deine letzte Änderung hier ist nicht gespeichert – markiere und kopiere sie bei
                Bedarf.
              </>
            )}
          </div>
          <button type="button" className={styles.knopf} onClick={() => setFrage('uebernehmen')}>
            {ichSelbst ? 'Hier weiterschreiben' : 'Schreiben übernehmen'}
          </button>
        </div>
      )}
      {lage === 'veraendert' && (
        <div className={styles.hinweis} role="alert">
          <Icon name="warnung" size={18} />
          <div>
            <b>Inzwischen hat jemand anderes gespeichert.</b> Damit nichts überschrieben wird,
            speichert dieses Fenster nicht mehr. Deine letzten Änderungen siehst du hier noch –
            markiere und kopiere sie bei Bedarf, dann lade den aktuellen Stand.
          </div>
          <button type="button" className={styles.knopf} onClick={neuLaden}>
            Aktuellen Stand laden
          </button>
        </div>
      )}
      {(lage === 'fest' || lage === 'weg') && (
        <div className={styles.hinweis} role="alert">
          <Icon name="lock" size={18} />
          <div>
            {lage === 'fest'
              ? 'Das Protokoll wurde inzwischen freigegeben und lässt sich nicht mehr ändern.'
              : 'Dieses Protokoll gibt es nicht mehr.'}
          </div>
          <button type="button" className={styles.knopf} onClick={neuLaden}>
            Neu laden
          </button>
        </div>
      )}
      {hinweis && (
        <p className={styles.nebenbei} role="status">
          {hinweis}
        </p>
      )}
      {vorschlagHinweis && (
        <p className={vorschlagStil.hinweis} role="status">
          <Icon name="idee" size={18} />
          {vorschlagHinweis}
        </p>
      )}
      {bearbeitbar && mOrt && (
        <VorschlaegeKasten
          liste={offeneVorschlaege}
          ich={schreiber.person}
          fehler={vorschlagFehler}
          aktionen={{
            uebernehmen: (v) =>
              vorschlagTun(async () => {
                await insProtokoll([v]);
              })(),
            naechstesMal: (v) =>
              vorschlagTun(async () =>
                vorschlagNeu(
                  await vorschlagSchreiben(mOrt, v.id, (x) =>
                    aufsNaechsteMal(x, sitzung, ichV, new Date().toISOString()),
                  ),
                ),
              )(),
            ablehnen: setAblehnenFuer,
          }}
        />
      )}
      {freigabe && (
        <FreigabeFenster
          hinweise={freigabe.hinweise}
          zusammenfassung={freigabe.zusammenfassung}
          mitTreffen={freigabe.treffen !== null}
          laedt={freigabe.laedtAnwesenheit || freigabe.laedtBeitrag}
          gruppe={gruppe}
          beitrag={freigabe.beitrag}
          onAnsehen={zurStelle}
          onFreigeben={freigebenJetzt}
          onFertig={() => {
            setFreigabe(null);
            if (onFreigegeben) onFreigegeben();
            else onZurueck(true);
          }}
          onClose={() => setFreigabe(null)}
        />
      )}
      {ablehnenFuer && mOrt && (
        <VorschlagAblehnen
          vorschlag={ablehnenFuer}
          onAblehnen={async (grund) => {
            vorschlagNeu(
              await vorschlagSchreiben(mOrt, ablehnenFuer.id, (x) =>
                ablehnen(x, grund, ichV, new Date().toISOString()),
              ),
            );
            setAblehnenFuer(null);
          }}
          onClose={() => setAblehnenFuer(null)}
        />
      )}

      {rahmen(
        <>
          {/* Beim Lesen bleibt der Editor bestehen (nur ausgeblendet) – sonst ginge, was noch nicht gespeichert ist, verloren. */}
          <div hidden={lesen}>
            <AufgabenKontext.Provider value={kontext}>
              <DokumentEditor
                key={laden.kopf.stand + laden.kopf.sitzung}
                start={laden.dokument}
                bearbeitbar={bearbeitbar}
                griff={editor}
                fremdeAufgabe={fremdeAufgabe}
                onAenderung={(d) => {
                  setDok(d);
                  setHinweis(null);
                  steuerung.current?.geaendert();
                }}
              />
            </AufgabenKontext.Provider>
          </div>
          {lesen && (
            <section className={ansicht.karte} aria-label="Protokoll">
              <ProtokollAnsicht dokument={dok} aufgaben={aufgaben} />
            </section>
          )}
          <Bereiche dokument={dok} aufgaben={aufgaben} naechste={naechste} />
        </>,
      )}

      {frage === 'uebernehmen' && sperre && (
        <ConfirmDialog
          title={ichSelbst ? 'Hier weiterschreiben?' : 'Schreiben übernehmen?'}
          message={
            ichSelbst
              ? 'Das andere Fenster hört dann auf zu speichern. Was dort seit dem letzten Speichern getippt wurde, bleibt nur dort sichtbar.'
              : `${sperre.name} kann dann nicht mehr speichern. Was seit dem letzten Speichern (${uhrzeit(sperre.seit, zeitzone)}) getippt wurde, bleibt nur in diesem anderen Fenster sichtbar.`
          }
          confirmLabel="Übernehmen"
          harmlos
          beschaeftigt={beschaeftigt}
          onConfirm={uebernehmen}
          onCancel={() => setFrage(null)}
        />
      )}
      {frage === 'verlassen' && (
        <ConfirmDialog
          title="Nicht gespeichert"
          message="Die letzten Änderungen konnten nicht gespeichert werden. Wenn du jetzt gehst, sind sie verloren."
          confirmLabel="Trotzdem verlassen"
          cancelLabel="Hierbleiben"
          onConfirm={() => {
            setFrage(null);
            void zurueck(true);
          }}
          onCancel={() => setFrage(null)}
        />
      )}
    </div>
  );
}

/** „gespeichert 19:42“, „speichert …“ oder „nicht gespeichert“ – oben neben dem Status. */
function SpeicherStand({ z, zeitzone }: { z: SteuerZustand; zeitzone: string }) {
  if (z.lage !== 'schreibe' && z.lage !== 'frei') return null;
  if (z.fehler)
    return (
      <span className={styles.fehler} role="status" title={z.fehler}>
        nicht gespeichert – wird erneut versucht
      </span>
    );
  if (z.speichert) return <span className={styles.stand}>speichert …</span>;
  if (z.offen) return <span className={styles.stand}>Änderungen …</span>;
  if (z.zuletzt)
    return (
      <span className={styles.stand}>
        <Icon name="cloud-check" size={16} /> gespeichert{' '}
        {uhrzeit(z.zuletzt.toISOString(), zeitzone)}
      </span>
    );
  return null;
}
