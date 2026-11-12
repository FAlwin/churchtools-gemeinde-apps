import { useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { Unklar } from '@ui/ct/fehler';
import type { Hinweis } from '@shared/protokolle/freigabe';
import type { Beitrag } from '@shared/protokolle/beitrag';
import felder from './Fensterfelder.module.scss';
import styles from './Freigabe.module.scss';

/** Was nach dem Freigeben noch scheitern kann – das Protokoll ist dann trotzdem frei. */
export interface FreigabeFolge {
  /** Gruppentreffen abschließen; fehlt, wenn es keins gibt. */
  treffen?: () => Promise<void>;
  /** Beitrag in der Gruppe (S6-2); fehlt ohne Häkchen. */
  beitrag?: () => Promise<void>;
}

type Schritt = keyof FreigabeFolge;
const SCHRITTE: readonly Schritt[] = ['treffen', 'beitrag'];

/** Ein gescheiterter Folgeschritt: warum – und ob „Nochmal versuchen“ ihn wiederholt (nicht bei „unklar“). */
interface Rest {
  schritt: Schritt;
  fehler: string;
  wiederholen: (() => Promise<void>) | null;
}

/** Die Folgeschritte nacheinander; jeder für sich – scheitert das Treffen, wird der Beitrag trotzdem versucht. */
async function abarbeiten(folge: FreigabeFolge): Promise<Rest[]> {
  const rest: Rest[] = [];
  for (const schritt of SCHRITTE) {
    const f = folge[schritt];
    if (!f) continue;
    try {
      await f();
    } catch (e) {
      rest.push({
        schritt,
        fehler: fehlerMeldung(e).text,
        wiederholen: e instanceof Unklar ? null : f,
      });
    }
  }
  return rest;
}

/**
 * **Fenster „Protokoll freigeben?“** (S6-1/S6-2, Entwurf `s6-freigabe-pdf-v1`): Hinweise (rot = einen Blick wert, grün =
 * Zusammenfassung) mit „Ansehen“, ein Satz, was passiert, das Häkchen „In der Gruppe Bescheid geben“ mit Vorschau (nur,
 * wo man Beiträge schreiben darf) und „Freigeben“. Freigeben geht trotz Hinweisen.
 *
 * `onFreigeben` schreibt das Protokoll frei und liefert, was danach noch zu tun ist (Treffen abschließen, Beitrag).
 * Scheitert so ein Folgeschritt, bleibt das Fenster offen: „Das Protokoll ist freigegeben – …“ mit „Nochmal versuchen“
 * für das, was sich gefahrlos wiederholen lässt.
 */
export function FreigabeFenster({
  hinweise,
  zusammenfassung,
  mitTreffen,
  laedt,
  gruppe,
  beitrag,
  onAnsehen,
  onFreigeben,
  onFertig,
  onClose,
}: {
  hinweise: readonly Hinweis[];
  zusammenfassung: string;
  /** Gibt es ein Gruppentreffen, das abgeschlossen wird? */
  mitTreffen: boolean;
  /** Die Hinweise werden noch gelesen (Anwesenheit aus ChurchTools). */
  laedt: boolean;
  /** Name der Gruppe – für den Satz unter dem Häkchen. */
  gruppe: string;
  /** Der Beitrag, wenn man in der Gruppe schreiben darf – sonst kein Häkchen. */
  beitrag: Beitrag | null;
  onAnsehen: (ziel: string) => void;
  /** `bescheid` = Häkchen „In der Gruppe Bescheid geben“ an. */
  onFreigeben: (bescheid: boolean) => Promise<FreigabeFolge>;
  /** Freigegeben und alles erledigt (oder bewusst so gelassen) – das Fenster geht zu. */
  onFertig: () => void;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bescheid, setBescheid] = useState(true);
  // Freigegeben, aber ein Folgeschritt scheiterte.
  const [rest, setRest] = useState<Rest[] | null>(null);

  const folge = async (f: FreigabeFolge) => {
    const r = await abarbeiten(f);
    if (r.length === 0) onFertig();
    else {
      setRest(r);
      setLaeuft(false);
    }
  };

  const freigeben = async () => {
    setLaeuft(true);
    setFehler(null);
    let f: FreigabeFolge;
    try {
      f = await onFreigeben(!!beitrag && bescheid);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setLaeuft(false);
      return;
    }
    await folge(f);
  };

  if (rest) {
    const nochmal = Object.fromEntries(
      rest.filter((r) => r.wiederholen).map((r) => [r.schritt, r.wiederholen!]),
    ) as FreigabeFolge;
    const kannNochmal = Object.keys(nochmal).length > 0;
    return (
      <Sheet
        title="Protokoll freigegeben"
        onClose={onFertig}
        cancelLabel="Schließen"
        beschaeftigt={laeuft}
        knoepfe={
          kannNochmal ? (
            <FensterKnopf
              disabled={laeuft}
              onClick={() => {
                setLaeuft(true);
                void folge(nochmal);
              }}
            >
              {laeuft ? 'Wird versucht …' : 'Nochmal versuchen'}
            </FensterKnopf>
          ) : undefined
        }
      >
        <p className={styles.info}>Das Protokoll ist freigegeben.</p>
        {rest.map((r) => (
          <RestZeile key={r.schritt} rest={r} />
        ))}
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Protokoll freigeben?"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft || laedt} onClick={() => void freigeben()}>
          <Icon name="stempel" size={18} /> {laeuft ? 'Wird freigegeben …' : 'Freigeben'}
        </FensterKnopf>
      }
    >
      <ul className={styles.hinweise} aria-label="Hinweise">
        {laedt && (
          <li>
            <span className={styles.zeichen} />
            <span className={styles.text}>Hinweise werden geladen …</span>
          </li>
        )}
        {hinweise.map((h) => (
          <li key={h.art} className={styles.warn}>
            <span className={styles.zeichen}>!</span>
            <span className={styles.text}>
              {h.text}
              {h.einzeln.length > 0 && <small>{h.einzeln.join(' · ')}</small>}
              {h.ziel && (
                <button type="button" className={styles.ansehen} onClick={() => onAnsehen(h.ziel!)}>
                  Ansehen
                </button>
              )}
            </span>
          </li>
        ))}
        <li className={styles.ok}>
          <span className={styles.zeichen}>✓</span>
          <span className={styles.text}>{zusammenfassung}</span>
        </li>
      </ul>
      <p className={styles.info}>
        Danach ist das Protokoll <b>fest</b>.
        {mitTreffen && (
          <>
            {' '}
            Das <b>Gruppentreffen wird abgeschlossen</b> – die Anwesenheit lässt sich dann nicht
            mehr ändern.
          </>
        )}{' '}
        To-Dos bleiben abhakbar. Die Leitung kann die Freigabe zurücknehmen.
      </p>
      {beitrag && (
        <>
          <label className={felder.schalter}>
            <input
              type="checkbox"
              className={felder.haken}
              checked={bescheid}
              disabled={laeuft}
              onChange={(e) => setBescheid(e.target.checked)}
            />
            <span>
              In der Gruppe Bescheid geben
              <small>
                Ein Beitrag in „{gruppe}“ von dir – ChurchTools benachrichtigt die Mitglieder nach
                ihren Einstellungen.
              </small>
            </span>
          </label>
          {bescheid && <BeitragVorschau beitrag={beitrag} />}
        </>
      )}
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}

/** So erscheint der Beitrag in der Gruppe – der Link ist hier nur Anzeige. */
function BeitragVorschau({ beitrag }: { beitrag: Beitrag }) {
  return (
    <div className={styles.vorschau} aria-label="Vorschau des Beitrags">
      <b>{beitrag.titel}</b>
      <span>{beitrag.satz}</span>
      <span className={styles.link}>Protokoll öffnen</span>
    </div>
  );
}

const WAS: Record<Schritt, { teil: ReactNode; folge: string }> = {
  treffen: {
    teil: (
      <>
        Das <b>Gruppentreffen</b> ließ sich aber nicht abschließen
      </>
    ),
    folge:
      'Ohne Abschluss lässt sich die Anwesenheit in ChurchTools noch ändern. Du kannst es später auch dort abschließen.',
  },
  beitrag: {
    teil: (
      <>
        Der <b>Beitrag in der Gruppe</b> ließ sich aber nicht erstellen
      </>
    ),
    folge: 'Die Mitglieder sehen das Protokoll trotzdem in den Protokollen.',
  },
};

function RestZeile({ rest }: { rest: Rest }) {
  const w = WAS[rest.schritt];
  return (
    <>
      <p className={styles.rest}>
        {w.teil}: {rest.fehler}
      </p>
      <p className={felder.leise}>{w.folge}</p>
    </>
  );
}
