import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Absence, AbsenceEvent, AbsenceReason, TerminArt } from '@shared/types/index';
import type { MeinDienstKurz } from '@shared/dienstplan/meineDienste';
import { veranstaltungsArten, WEITERE } from '@shared/dienstplan/termine';
import {
  AbwesenheitenSeite,
  type AbwesenheitenDaten,
  type AbwesenheitenSchreiben,
} from '@ui/abwesenheiten/AbwesenheitenSeite';
import { abwesenheitenDienst, type AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { leseImGeraet, merkeImGeraet, texte } from '@ui/bedienung/geraet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useToast } from '@ui/fenster/useToast';
import { Toast } from '@ui/fenster/Toast';
import { Icon } from '@ui/icons/icons';
import { ladeMeineDienste } from './ladeBeiwerk';
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

/**
 * **Reiter „Abwesenheiten“ im Dienstplaner** (Bauplan E7-2c) – die gemeinsame Seite aus `@ui/abwesenheiten` (dieselbe
 * wie in der Musik-App), hier mit den eigenen Diensten in der Terminzeile. Liest und schreibt direkt in ChurchTools;
 * ein Recht braucht es nicht (die eigenen Abwesenheiten darf jede Person pflegen).
 */
export function Abwesenheiten({
  ichId,
  zeitzone,
  heute,
}: {
  ichId: number;
  zeitzone: string;
  heute: string;
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

  return (
    <QuelleKontext.Provider value={quelle}>
      <AbwesenheitenSeite
        online
        onToast={showToast}
        heute={heute}
        useDaten={useDienstplanerDaten}
        schreiben={schreiben}
        arten={artenAus}
        filter={filter}
        terminZusatz={(ev, abwesend) => (
          <DienstHinweis dienste={dienste?.get(ev.id)} abwesend={abwesend} />
        )}
        rahmen={(t) => (
          <section className={styles.karte} aria-label="Abwesenheiten">
            <div className={styles.kopf}>
              {t.kopf}
              <span className={styles.rechts}>{t.aktionen}</span>
            </div>
            {t.fehler ? (
              <div className={styles.hinweis}>
                <FehlerKasten
                  fehler={fehlerMeldung(new Error('Abwesenheiten konnten nicht geladen werden.'))}
                  onNochmal={() => void t.neuLaden()}
                />
              </div>
            ) : t.laedt ? (
              <p className={styles.hinweis}>Abwesenheiten werden geladen …</p>
            ) : (
              t.inhalt
            )}
            <div className={styles.unten}>{t.ueberlagerung}</div>
            <Toast message={toast} />
          </section>
        )}
      />
    </QuelleKontext.Provider>
  );
}
