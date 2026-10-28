import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
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
  neueAufgabe,
  statusSetzen,
  type Aufgabe,
  type AufgabenStatus,
} from '@shared/protokolle/aufgaben';
import type { Person } from '@shared/organigramm/mitglieder';
import { AufgabenKontext, type AufgabenKontextWert } from './aufgabenKontext';
import {
  aufgabeAendern,
  aufgabenSchreiben,
  aufgabenWerte,
  type MitarbeitOrt,
} from './aufgabenSchreiben';
import { ladeGruppenMitglieder } from './mitglieder';
import { uhrzeit, wannLang } from './anzeige';
import { Bereiche } from './Bereiche';
import { DokumentEditor, type EditorGriff } from './DokumentEditor';
import { EDITOR_TYPEN } from './editorSchema';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import { Marke } from './Marke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import {
  protokollLesen,
  schreibenUebernehmen,
  speichern,
  sperreFreigeben,
  sperreNehmen,
  type ProtokollOrt,
} from './schreiben';
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
  onZurueck,
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
  /** `geaendert` = es wurde gespeichert; die Liste dahinter lädt dann neu. */
  onZurueck: (geaendert: boolean) => void;
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
  const [mitglieder, setMitglieder] = useState<readonly Person[] | 'verborgen' | null>(null);
  // Änderungen an To-Dos nacheinander – zwei schnelle Klicks dürfen sich nicht gegenseitig überschreiben.
  const kette = useRef<Promise<unknown>>(Promise.resolve());

  const oeffnen = useCallback(() => {
    setLaden({ art: 'laedt' });
    Promise.all([
      protokollLesen(ort),
      mOrt ? aufgabenWerte(mOrt).then((w) => w.map((x) => x.aufgabe)) : Promise.resolve([]),
    ]).then(
      ([{ kopf, dokument }, alle]) => {
        setTodos(alle);
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
            speichern: (stand, d) =>
              speichern(
                ort,
                schreiber,
                stand,
                d,
                new Date(),
                mOrt
                  ? async () =>
                      setTodos(
                        await aufgabenSchreiben(mOrt, (vorhanden) =>
                          aufgabenAbgleich({
                            eintraege: ableiten(d).aufgaben,
                            vorhanden,
                            gruppe: gruppeId,
                            sitzung: ort.sitzung,
                            von: schreiber.person,
                            am: new Date().toISOString(),
                          }),
                        ),
                      )
                  : undefined,
              ),
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
  }, [ort, schreiber, mOrt, gruppeId, setTodos]);

  useEffect(oeffnen, [oeffnen]);

  // Wer eine Aufgabe übernehmen kann – einmal je Editor; ein Fehler lässt die Liste leer („werden geladen“ bleibt nicht
  // stehen: dann gibt es nur den externen Namen, und der Hinweis sagt es).
  useEffect(() => {
    let aktiv = true;
    ladeGruppenMitglieder(gruppeId).then(
      (m) => aktiv && setMitglieder(m),
      () => aktiv && setMitglieder('verborgen'),
    );
    return () => {
      aktiv = false;
    };
  }, [gruppeId]);

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
        .then(() => aufgabeAendern(mOrt, id, f, anlegen))
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
    [mOrt, gruppeId, ort.sitzung, schreiber.person, setTodos],
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
  const nameVon = useCallback(
    (p: number) =>
      mitglieder && mitglieder !== 'verborgen'
        ? (mitglieder.find((m) => m.id === p)?.name ?? null)
        : null,
    [mitglieder],
  );

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
    onZurueck(gespeichert.current);
  };

  const neuLaden = () => {
    setHinweis(null);
    oeffnen();
  };

  const aufgaben = useMemo(() => [...todos.values()].filter((a) => !a.geloescht), [todos]);

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
    >
      {inhalt}
    </FestePunkteRahmen>
  );

  const kopfZeile = (
    <>
      <button
        type="button"
        className={ansicht.zurueck}
        onClick={() => void zurueck()}
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
      </header>
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
        ich: schreiber.person,
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
