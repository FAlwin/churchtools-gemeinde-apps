/**
 * **Bearbeiten mit Sperre, Schlange und Speichern – der Ablauf, den Seiten und Aussehen teilen** (W3a-2c, W3a-3). Aus
 * `Seitenarbeit` herausgelöst, damit der Reiter „Aussehen“ **denselben** Ablauf benutzt statt ihn nachzubauen (Regel-Dopplung).
 * Was Seite und Aussehen unterscheidet, steckt in `SperrArbeit` (wo gelesen, gesperrt, geschrieben wird, was „gleich“ heißt);
 * die Regeln darunter gelten für beide:
 *
 * - **Gespeichert wird eins nach dem anderen** (`Speicherschlange`); ein Fehler lässt die Arbeitskopie stehen („Erneut
 *   versuchen“, kein Neuladen).
 * - **Die Sperre** wird beim ersten Handgriff genommen (`sicherstellen`), solange erneuert, wie das Fenster offen ist, und beim
 *   Verlassen freigegeben (so gut es geht). Vor jedem Speichern wird sie erneut geprüft – **und der gespeicherte Stand
 *   verglichen**: Hat jemand anderes inzwischen etwas geändert, wird nicht darüber geschrieben (`veraendert`).
 * - **Ein halb gelungener Speicherversuch** (`versucht`) zählt beim nächsten Vergleich als bekannter Stand – sonst hielte sich
 *   eine Person nach einem Aussetzer mitten im Schreiben selbst für „jemand anderen“.
 * - **Übernehmen** („Hier weiterbearbeiten“/„Bearbeitung übernehmen“) und **Neu laden** setzen mit dem gespeicherten Stand fort.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { sperreLage, type Schreiber, type Sperre } from '@shared/ct/sperre';
import { Speicherschlange, type SchlangenStand } from '@shared/website/schlange';
import { LEBENSZEICHEN_MS } from './regeln';
import type { SperrTexte } from './sperrTexte';

/** Der frisch gelesene Stand: `null` = es gibt ihn nicht (mehr) – `{ wert }` = so liegt er gespeichert da. */
export type Frisch<W> = { wert: W } | null;

export type Beginn<W> = { art: 'ok'; frisch: Frisch<W> } | { art: 'gesperrt'; sperre: Sperre };

export interface SperrArbeit<W> {
  ich: Schreiber;
  /** Die Sperre, wie sie beim Öffnen gelesen wurde (ob sie noch gilt und fremd ist, entscheidet der Hook). */
  anfangFremd: Sperre | null;
  /** Der gespeicherte Stand beim Öffnen. */
  anfang: W;
  texte: SperrTexte;
  /** Die Sperre nehmen oder erneuern – und den frisch gelesenen Stand liefern. Wirft bei jedem Fehler. */
  beginne: () => Promise<Beginn<W>>;
  /** Die Sperre bewusst wegnehmen. */
  uebernimm: () => Promise<Beginn<W>>;
  /** Die eigene Sperre freigeben (der Hook fängt Fehler ab). */
  beende: () => Promise<void>;
  /** Schreiben – erst, nachdem Sperre und Stand geprüft sind. `gespeichert` ist der Stand davor. */
  schreibe: (wert: W, gespeichert: W) => Promise<void>;
  /** Sind das derselbe gespeicherte Stand? (Bei Seiten: nur die Seite, nicht das Menü.) */
  gleich: (a: W, b: W) => boolean;
  /** Den gespeicherten Stand bewusst als Arbeitskopie übernehmen (beim Übernehmen, Neuladen, veraltetem Stand). */
  anwenden: (wert: W) => void;
  /** Nach jedem gelungenen Speichern. */
  nachSpeichern: (wert: W) => void;
  /** Ist etwas noch nicht gespeichert? */
  onOffen: (offen: boolean) => void;
}

export function useSperrarbeit<W>(cfg: SperrArbeit<W>) {
  const c = useRef(cfg);
  c.current = cfg;

  const [speicher, setSpeicher] = useState<SchlangenStand>({ art: 'gespeichert' });
  /** Wer sonst bearbeitet (Anzeige) – `null`: niemand. Beim Öffnen aus dem gelesenen Stand, danach aus jeder Prüfung. */
  const [fremd, setFremd] = useState<Sperre | null>(() => {
    const s = cfg.anfangFremd;
    return s && sperreLage(s, cfg.ich, new Date()) === 'fremd' ? s : null;
  });
  /** Hat uns ein anderes Fenster die Sperre abgenommen, die wir hielten? (Dann steht das im Hinweis.) */
  const [verdraengt, setVerdraengt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  /** Die Rückfrage „Bearbeitung übernehmen?“ ist offen. */
  const [frageUebernehmen, setFrageUebernehmen] = useState(false);
  const [uebernimmt, setUebernimmt] = useState(false);
  /** Gehört die Sperre diesem Fenster? */
  const halte = useRef(false);
  /** Was zuletzt gespeichert oder geladen ist – die Grundlage für „hat jemand anderes etwas geändert?“. */
  const letzte = useRef<W>(cfg.anfang);
  /** Alles, was ein (vielleicht halb gelungener) Speicherversuch geschrieben haben kann. */
  const versucht = useRef<W[]>([]);
  const lauf = useRef<Promise<boolean> | null>(null);
  /** Die Oberfläche ist weg, ein Speichern lief aber noch – dann wird die Sperre erst danach freigegeben. */
  const abgemeldet = useRef(false);
  /** Die Sperre freigeben – nur wenn sie uns gehört; Fehler fängt der Aufrufer nicht, sie verfällt dann von selbst. */
  const frei = useRef(() => {});
  frei.current = () => {
    if (!halte.current) return;
    halte.current = false;
    c.current.beende().catch(() => {});
  };

  const schlange = useRef<Speicherschlange<W> | null>(null);
  schlange.current ??= new Speicherschlange<W>(
    async (wert) => {
      // Unmittelbar vor dem Schreiben: Gehört die Sperre noch uns? Und hat niemand etwas inzwischen geändert?
      const b = await c.current.beginne();
      if (b.art === 'gesperrt') {
        setVerdraengt(halte.current);
        halte.current = false;
        setFremd(b.sperre);
        return { art: 'gesperrt' };
      }
      halte.current = true;
      setFremd(null);
      const gespeichert = letzte.current;
      const { gleich } = c.current;
      const kennt = (w: W) => gleich(w, gespeichert) || versucht.current.some((v) => gleich(w, v));
      if (!b.frisch || !kennt(b.frisch.wert)) return { art: 'veraendert' };
      versucht.current.push(wert);
      await c.current.schreibe(wert, gespeichert);
      letzte.current = wert;
      versucht.current = [];
      c.current.nachSpeichern(wert);
      return { art: 'ok' };
    },
    (stand) => {
      setSpeicher(stand);
      // Hat die Oberfläche beim Verlassen noch etwas zu speichern gehabt, ist hier das Ende (gespeichert, Fehler oder
      // abgewiesen): erst jetzt die Sperre freigeben – früher würde sie das laufende Speichern überholen und wieder nehmen.
      if (abgemeldet.current && stand.art !== 'speichert') frei.current();
    },
  );

  const offen = speicher.art !== 'gespeichert';
  useEffect(() => {
    c.current.onOffen(offen);
  }, [offen]);
  // Etwas Ungespeichertes verlässt man nicht aus Versehen.
  useEffect(() => {
    if (!offen) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [offen]);

  /** Den gespeicherten Stand bewusst als Arbeitskopie übernehmen. */
  const uebernimmFrisch = useCallback((wert: W) => {
    letzte.current = wert;
    versucht.current = [];
    c.current.anwenden(wert);
  }, []);

  /**
   * Vor dem ersten Handgriff: die Sperre nehmen. `true` = es darf losgehen. `false` = nein (fremd gesperrt, der Stand hat sich
   * inzwischen geändert und wurde neu geladen, oder ChurchTools antwortet nicht) – der Grund steht dann im Hinweis.
   * Gleichzeitige Aufrufe teilen sich ein Ergebnis.
   */
  const sicherstellen = useCallback((): Promise<boolean> => {
    if (halte.current) return Promise.resolve(true);
    lauf.current ??= (async () => {
      try {
        const b = await c.current.beginne();
        if (b.art === 'gesperrt') {
          setFremd(b.sperre);
          return false;
        }
        halte.current = true;
        setFremd(null);
        setVerdraengt(false);
        if (!b.frisch) {
          setHinweis(c.current.texte.weg);
          return false;
        }
        if (!c.current.gleich(b.frisch.wert, letzte.current)) {
          uebernimmFrisch(b.frisch.wert);
          setHinweis(c.current.texte.neuGeladen);
          return false;
        }
        return true;
      } catch (e) {
        setHinweis(fehlerMeldung(e).text);
        return false;
      } finally {
        lauf.current = null;
      }
    })();
    return lauf.current;
  }, [uebernimmFrisch]);

  // Lebenszeichen, solange die Sperre bei uns liegt.
  useEffect(() => {
    if (fremd !== null) return;
    const takt = setInterval(() => {
      if (!halte.current) return;
      c.current.beginne().then(
        (b) => {
          if (b.art === 'gesperrt') {
            setVerdraengt(true);
            halte.current = false;
            setFremd(b.sperre);
          }
        },
        () => {
          // Ein Aussetzer ist kein Verlust: Das nächste Lebenszeichen (oder das Speichern) versucht es wieder.
        },
      );
    }, LEBENSZEICHEN_MS);
    return () => clearInterval(takt);
  }, [fremd]);

  // Beim Verlassen freigeben – so gut es geht (sonst verfällt die Sperre nach zehn Minuten von selbst).
  useEffect(() => {
    abgemeldet.current = false;
    const beiPagehide = () => frei.current();
    window.addEventListener('pagehide', beiPagehide);
    return () => {
      window.removeEventListener('pagehide', beiPagehide);
      abgemeldet.current = true;
      // Läuft noch ein Speichern (z. B. das letzte, kurz vor dem Reiterwechsel angestoßene), gibt dessen Ende die
      // Sperre frei (`beiStand` oben) – sonst sofort.
      if (!schlange.current!.aktiv) frei.current();
    };
  }, []);

  /** Ergebnis von „übernehmen“ und „neu laden“: gesperrt, weg oder frisch – mit dem Aufräumen, das beide gleich brauchen. */
  const nimmFrisch = (b: Beginn<W>): boolean => {
    if (b.art === 'gesperrt') return false;
    halte.current = true;
    setFremd(null);
    setVerdraengt(false);
    if (b.frisch) uebernimmFrisch(b.frisch.wert);
    else setHinweis(c.current.texte.weg);
    return true;
  };

  /**
   * „Hier weiterbearbeiten“ / „Bearbeitung übernehmen“ (nach der Rückfrage): die Sperre bewusst nehmen – wie „Schreiben
   * übernehmen“ der Protokolle. Es geht mit dem **gespeicherten** Stand weiter; ungespeicherte Änderungen dieses Fensters
   * entfallen. Klappt das Schreiben nicht, bleibt alles gesperrt und der Grund steht im Hinweis.
   */
  const bearbeitungUebernehmen = async () => {
    setUebernimmt(true);
    setHinweis(null);
    try {
      const b = await c.current.uebernimm();
      if (b.art === 'gesperrt') {
        setFremd(b.sperre);
        setHinweis(
          `Das hat nicht geklappt – ${b.sperre.name} hat gerade wieder gespeichert. Bitte noch einmal versuchen.`,
        );
        return;
      }
      schlange.current!.verwerfen();
      setSpeicher({ art: 'gespeichert' });
      nimmFrisch(b);
    } catch (e) {
      setHinweis(fehlerMeldung(e).text);
    } finally {
      setUebernimmt(false);
      setFrageUebernehmen(false);
    }
  };

  /** „Neu laden“ nach einer Abweisung: der gespeicherte Stand ersetzt die Arbeitskopie – bewusst, mit Folge. */
  const neuLaden = async () => {
    schlange.current!.verwerfen();
    setSpeicher({ art: 'gespeichert' });
    halte.current = false;
    try {
      const b = await c.current.beginne();
      if (b.art === 'gesperrt') return setFremd(b.sperre);
      nimmFrisch(b);
    } catch (e) {
      setHinweis(fehlerMeldung(e).text);
    }
  };

  return {
    speicher,
    fremd,
    verdraengt,
    hinweis,
    setHinweis,
    frageUebernehmen,
    setFrageUebernehmen,
    uebernimmt,
    schlange: schlange.current,
    sicherstellen,
    uebernimmFrisch,
    bearbeitungUebernehmen,
    neuLaden,
  };
}

/** Was die Bänder von dem Ablauf brauchen – unabhängig davon, was gespeichert wird. */
export type Sperrarbeit = Omit<
  ReturnType<typeof useSperrarbeit>,
  'schlange' | 'uebernimmFrisch'
> & {
  schlange: { nochmal: () => void };
};
