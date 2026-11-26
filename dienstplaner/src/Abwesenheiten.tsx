import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Absence, AbsenceEvent, AbsenceReason, TerminArt } from '@shared/types/index';
import type { MeinDienstKurz } from '@shared/dienstplan/meineDienste';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { veranstaltungsArten, WEITERE } from '@shared/dienstplan/termine';
import {
  AbwesenheitenSeite,
  type AbwesenheitenDaten,
  type AbwesenheitenSchreiben,
  type Zusagen,
} from '@ui/abwesenheiten/AbwesenheitenSeite';
import { abwesenheitenDienst, type AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { useToast } from '@ui/fenster/useToast';
import { Toast } from '@ui/fenster/Toast';
import { Icon } from '@ui/icons/icons';
import { ladeMeineDienste } from './ladeBeiwerk';
import { AbfrageBand } from './AbfrageBand';
import { austrittFuerEigene, useBand } from './useAbfragen';
import { adresseFuer } from './reiter';
import type { Start } from './start';
import type { Zeitraum } from '@shared/ct/zeitraum';
import {
  einrichtbareGruppen,
  ladeVerfuegbarkeit,
  richteAntwortenEin,
  speichereVerfuegbarkeit,
  verfuegbarkeitHinweis,
  type SpeichernErgebnis,
  type Verfuegbarkeit,
} from './ladeVerfuegbarkeit';
import styles from './Abwesenheiten.module.scss';

/** Die ausgeblendeten Veranstaltungsarten der Abwesenheiten – im Gerät, getrennt von der Auswahl in „Dienste“. */
const FILTER = 'dienstplaner.abwesenheiten.ausgeblendet';
const filter = {
  lesen: () =>
    leseImGeraet<string[] | null>(FILTER, null, (roh) => (roh == null ? null : texte(roh))),
  schreiben: (ids: string[]) => merkeImGeraet(FILTER, ids),
  // Eine alte Einzelwahl wie in der Musik-App gab es hier nie.
  alteWahl: () => [],
};

/** Was der Daten-Hook der Seite braucht – über einen Kontext, weil die Seite `useDaten` nur den Bereich gibt. */
interface Quelle {
  dienst: AbwesenheitenDienst;
  heute: string;
  /** Zählt bei jedem Schreiben hoch – dann lädt der Hook die Einträge neu. */
  stand: number;
}
const QuelleKontext = createContext<Quelle | null>(null);

/**
 * **Die Daten der Abwesenheiten im Dienstplaner** – direkt aus ChurchTools (`ctDienst`), ohne Zwischenspeicher:
 * Einträge im Bereich, Termine ab heute bis `bis`, die Gründe. Ein Fehler zeigt „Erneut versuchen“, nichts Halbes.
 */
function useDienstplanerDaten({ von, bis }: { von: string; bis: string }): AbwesenheitenDaten {
  const q = useContext(QuelleKontext);
  if (!q) throw new Error('Abwesenheiten ohne Quelle');
  const { dienst, heute, stand } = q;
  const [eintraege, setEintraege] = useState<Absence[]>();
  const [termine, setTermine] = useState<AbsenceEvent[]>();
  const [gruende, setGruende] = useState<AbsenceReason[]>();
  const [fehler, setFehler] = useState(false);

  const laden = useMemo(
    () => (): Promise<unknown> => {
      setFehler(false);
      return Promise.all([
        dienst.meine(von, bis).then(setEintraege),
        dienst.termine(heute, bis).then(setTermine),
      ]).catch((e: unknown) => {
        console.warn('[abwesenheiten] nicht geladen:', e);
        setFehler(true);
      });
    },
    [dienst, heute, von, bis],
  );

  // `stand` zählt bei jedem Schreiben hoch – dann die Einträge neu (die Termine ändern sich dadurch nicht, kosten aber
  // nur einen Aufruf; beide zusammen halten den Stand einfach).
  useEffect(() => {
    void laden();
  }, [laden, stand]);

  useEffect(() => {
    // Die Gründe sind Beiwerk: ohne sie steht im Fenster keine Auswahl (der Dienst nimmt dann den vorgewählten).
    dienst.gruende().then(setGruende, () => setGruende([]));
  }, [dienst]);

  return {
    eintraege,
    termine,
    gruende,
    laedt: !fehler && (eintraege === undefined || termine === undefined),
    fehler,
    neuLaden: () => {
      setEintraege(undefined);
      return laden();
    },
  };
}

/** Die Veranstaltungsarten wie im Reiter „Dienste“ (jeder Name, der mindestens zweimal vorkommt) als Filter-Arten. */
function artenAus(termine: AbsenceEvent[]): TerminArt[] {
  return veranstaltungsArten(termine)
    .filter((name) => name !== WEITERE)
    .map((name) => ({ id: name, name, suchwort: name }));
}

/**
 * Die eigenen Dienste unter einem Termin (Entwurf E7-2, Alwin 04.11.2026): „Du bist eingeteilt: Ton“ / „Angefragt:
 * Gesang“. Ist der Termin abgehakt, in Rot mit „bitte auch den Dienst absagen“ – die Abwesenheit allein sagt dem Planer
 * nichts.
 */
export function DienstHinweis({
  dienste,
  abwesend,
}: {
  dienste: MeinDienstKurz[] | undefined;
  abwesend: boolean;
}) {
  if (!dienste || dienste.length === 0) return null;
  const zugesagt = dienste.filter((d) => d.zugesagt).map((d) => d.name);
  const offen = dienste.filter((d) => !d.zugesagt).map((d) => d.name);
  const teile = [
    zugesagt.length > 0 ? `Du bist eingeteilt: ${zugesagt.join(', ')}` : null,
    offen.length > 0 ? `Angefragt: ${offen.join(', ')}` : null,
  ].filter(Boolean);
  if (abwesend) {
    return (
      <span className={`${styles.dienst} ${styles.warn}`}>
        <Icon name="warnung" size={14} />
        {teile.join(' · ')} – bitte auch {dienste.length > 1 ? 'die Dienste' : 'den Dienst'} absagen
      </span>
    );
  }
  return (
    <span className={styles.dienst}>
      <Icon name="people" size={14} />
      {teile.join(' · ')}
    </span>
  );
}

const KEINE_DIENSTE: { id: number; name: string }[] = [];

const GERADE_NICHT =
  'Ja/Vielleicht geht gerade nicht: ChurchTools antwortet nicht. Nichts verloren – Nein geht weiter, später bitte noch einmal.';

/**
 * **Ja/Vielleicht für die Seite** (E5c-1c): lädt die eigenen Antworten aus den Speichern der eigenen Dienstgruppen und
 * reicht sie samt Speichern, Sperr-Hinweis und „Einrichten“ herein. Ohne bereiten Speicher oder bei einem Lesefehler
 * sind Ja/Vielleicht gesperrt – „Nein“ (die Abwesenheit) geht immer.
 */
function useZusagen(
  ichId: number,
  dienstgruppen: Dienstgruppe[],
  heute: string,
  dienste: { id: number; name: string }[],
  /**
   * Zählt nach JEDEM Speicherversuch hoch (derselbe Zähler wie bei den Abwesenheiten, `geaendert`). Daran laden auch die
   * Antworten neu – auch nach einem Fehlschlag. Fund 18.11.2026 (Test-Instanz): Hatte jemand anderswo inzwischen
   * umgestellt, scheiterte das Speichern an der Abwesenheit; die Abwesenheiten kamen frisch, Ja/Vielleicht blieben alt –
   * der Termin stand bis zum Neuladen ohne Antwort da.
   */
  schreibStand: number,
): Zusagen {
  // Geladen wie überall in den Erweiterungen (`useLaden`): späte Antworten zählen nicht, und beim Neuladen bleibt der
  // bisherige Stand stehen, bis der neue da ist – scheitert das Neuladen, gilt weiter der bisherige.
  const { stand, neu, setze } = useLaden(
    () => ladeVerfuegbarkeit(dienstgruppen, ichId),
    [dienstgruppen, ichId],
    {
      behalten: true,
    },
  );
  // Nach jedem Speicherversuch neu – auch nach einem gescheiterten (siehe `schreibStand`). Beim ersten Zeichnen nicht,
  // da lädt `useLaden` ohnehin.
  useEffect(() => {
    if (schreibStand > 0) neu();
  }, [schreibStand, neu]);
  const v: Verfuegbarkeit | null = stand.art === 'fertig' ? stand.daten : null;
  const fehlerText = stand.art === 'fehler' ? stand.fehler.text : null;
  useEffect(() => {
    if (fehlerText) console.warn('[wann-kann-ich] Antworten nicht geladen:', fehlerText);
  }, [fehlerText]);
  const einrichtbar = v ? einrichtbareGruppen(v) : [];
  return {
    antworten: v?.antworten ?? {},
    dienste,
    bereit: v !== null && v.bereit.length > 0 && v.lesefehler === null,
    hinweis: stand.art === 'fehler' ? GERADE_NICHT : v ? verfuegbarkeitHinweis(v) : null,
    einrichten:
      einrichtbar.length > 0
        ? {
            gruppen: einrichtbar.map((g) => g.name),
            los: async () => {
              await richteAntwortenEin(einrichtbar);
              neu();
            },
          }
        : undefined,
    speichern: async (antworten) => {
      if (!v) return { ok: false, text: GERADE_NICHT };
      let r: SpeichernErgebnis;
      try {
        r = await speichereVerfuegbarkeit(v, ichId, antworten, heute);
      } catch (e) {
        console.warn('[wann-kann-ich] Speichern fehlgeschlagen:', e);
        r = {
          ok: false,
          text: 'Ja/Vielleicht konnte nicht gespeichert werden – bitte noch einmal.',
        };
      }
      // Gelungen heißt: nachgelesen steht es da – dann gilt die geschriebene Karte sofort. Den wahren Stand holt danach
      // in jedem Fall `schreibStand` (die Seite meldet jeden Speicherversuch über `geaendert`, auch einen gescheiterten).
      if (r.ok) setze((alt) => ({ ...alt, antworten }));
      return r;
    },
  };
}

/**
 * **Reiter „Verfügbarkeit“ im Dienstplaner** (Bauplan E7-2c, seit E5c-1c mit Ja · Vielleicht · Nein) – die gemeinsame
 * Seite aus `@ui/abwesenheiten` (dieselbe wie in der Musik-App, dort mit dem Haken), hier mit den eigenen Diensten in der
 * Terminzeile. „Nein“ ist eine Abwesenheit in ChurchTools, Ja/Vielleicht liegen im Speicher der eigenen Dienstgruppen
 * (`ladeVerfuegbarkeit`). Ein Recht braucht es für „Nein“ nicht (die eigenen Abwesenheiten darf jede Person pflegen).
 * Die Adresse bleibt `#/abwesenheiten` (gemerkte Links, Erinnerungs-Mail).
 */
export function Abwesenheiten({
  ichId,
  zeitzone,
  heute,
  dienstgruppen,
  eigeneDienste = KEINE_DIENSTE,
  start,
  abfrageGruppe = null,
}: {
  ichId: number;
  zeitzone: string;
  heute: string;
  /** Die eigenen Dienstgruppen (`eigeneDienstgruppen`) – in sie gehören Ja/Vielleicht. Eine feste Liste je Start. */
  dienstgruppen: Dienstgruppe[];
  /** Die eigenen Dienste (`eigeneDienste`) – für „nur bestimmte Dienste“ bei der Notiz. Eine feste Liste je Start. */
  eigeneDienste?: { id: number; name: string }[];
  /**
   * „Verfügbarkeit“ mit einer Abfrage (R-3, `#/abwesenheiten?abfrage=<Dienstgruppe>`): Mit gültiger laufender Abfrage steht über
   * der Liste ein Band, und die Liste zeigt genau ihren Zeitraum. Ohne `start` oder ohne gültige Abfrage: die Seite wie bisher.
   */
  start?: Start;
  abfrageGruppe?: number | null;
}) {
  const dienst = useMemo(
    () => abwesenheitenDienst({ ich: () => Promise.resolve(ichId), zeitzone }),
    [ichId, zeitzone],
  );
  const [stand, setStand] = useState(0);
  const { toast, showToast } = useToast();
  const [dienste, setDienste] = useState<Map<number, MeinDienstKurz[]>>();
  useEffect(() => {
    // Beiwerk: Scheitert es, fehlt nur der Hinweis unter den Terminen.
    ladeMeineDienste(ichId).then(setDienste, (e: unknown) =>
      console.warn('[abwesenheiten] eigene Dienste nicht geladen:', e),
    );
  }, [ichId]);

  const schreiben: AbwesenheitenSchreiben = {
    anlegen: (neu) => dienst.anlegen(neu),
    aendern: (id, neu) => dienst.aendern(id, neu),
    loeschen: (id) => dienst.loeschen(id),
    geaendert: () => setStand((n) => n + 1),
  };
  const quelle = useMemo(() => ({ dienst, heute, stand }), [dienst, heute, stand]);
  const zusagen = useZusagen(ichId, dienstgruppen, heute, eigeneDienste, stand);
  const { wartet, band } = useBand({
    start,
    dienstgruppeId: start ? abfrageGruppe : null,
    heute,
    zeitzone,
    antworten: zusagen.antworten,
    schreibStand: stand,
  });
  // Austritt beim Antworten (R-5b): Nach jedem Speicherversuch prüft die App, ob in einer eingerichteten Abfrage nichts mehr offen
  // ist, und trägt mich dann aus der Hilfsgruppe aus. Leise, ein Lauf zur Zeit, kein Wiederhol-Takt.
  const austrittLaeuft = useRef(false);
  const austrittNochmal = useRef(false);
  useEffect(() => {
    if (stand === 0 || !start) return;
    // Kommt ein Speichern, während eine Prüfung läuft, gilt sie danach noch einmal (nie stillschweigend verworfen).
    if (austrittLaeuft.current) {
      austrittNochmal.current = true;
      return;
    }
    austrittLaeuft.current = true;
    void (async () => {
      do {
        austrittNochmal.current = false;
        await austrittFuerEigene(start, heute, zeitzone);
      } while (austrittNochmal.current);
      austrittLaeuft.current = false;
    })();
  }, [stand, start, heute, zeitzone]);
  const anfang: Zeitraum | undefined = band
    ? { art: 'eigen', von: band.lage.abfrage.von, bis: band.lage.abfrage.bis }
    : undefined;

  // Mit Abfrage in der Adresse erst deren Zeitraum kennen, dann die Seite aufbauen (kein Springen von „ab heute“).
  if (wartet)
    return (
      <div className={styles.seite}>
        <p className={styles.hinweis} role="status">
          Wird geladen …
        </p>
      </div>
    );

  return (
    <QuelleKontext.Provider value={quelle}>
      <AbwesenheitenSeite
        // Neu aufbauen, wenn die Abfrage beginnt oder endet („Alle Termine zeigen“) – sonst bliebe ihr Zeitraum stehen.
        key={band ? band.lage.abfrage.id : 'ohne'}
        anfangsZeitraum={anfang}
        online
        onToast={showToast}
        heute={heute}
        useDaten={useDienstplanerDaten}
        schreiben={schreiben}
        arten={artenAus}
        filter={filter}
        zusagen={zusagen}
        terminZusatz={(ev, abwesend) => (
          <DienstHinweis dienste={dienste?.get(ev.id)} abwesend={abwesend} />
        )}
        rahmen={(t) => (
          <div className={styles.seite}>
            {/* Die Werkzeugzeile steht über der Karte, nicht darin (B4, R5). */}
            {t.werkzeug}
            {band && (
              <AbfrageBand
                gruppe={band.lage.gruppe.name}
                abfrage={band.lage.abfrage}
                stand={
                  band.stand ? { offen: band.stand.offen.length, gesamt: band.stand.gesamt } : null
                }
                heute={heute}
                onAlle={() => {
                  window.location.hash = adresseFuer('abwesenheiten');
                }}
              />
            )}
            <section className={styles.karte} aria-label="Verfügbarkeit">
              {t.fehler ? (
                <div className={styles.hinweis}>
                  <FehlerKasten
                    fehler={fehlerMeldung(new Error('Abwesenheiten konnten nicht geladen werden.'))}
                    onNochmal={() => void t.neuLaden()}
                  />
                </div>
              ) : t.laedt ? (
                <p className={styles.hinweis}>Deine Termine werden geladen …</p>
              ) : (
                t.inhalt
              )}
              <Toast message={toast} />
            </section>
            {/* Außerhalb der Karte: `.karte` hat `overflow: hidden`, und das machte die Karte zum Rollbereich der
                klebenden Leiste – sie klebte am Kartenende statt am unteren Rand (B8a). */}
            <div className={styles.unten}>{t.ueberlagerung}</div>
          </div>
        )}
      />
    </QuelleKontext.Provider>
  );
}
