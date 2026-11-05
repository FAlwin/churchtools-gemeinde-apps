import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { uhrText } from '@shared/ct/zeit';
import { zugangLesen, zugangSpeichern, type Stand } from '@shared/gebetsabend/ablage';
import { KATEGORIE_ZUGANG } from '@shared/gebetsabend/einrichten';
import {
  beendet,
  senderBleibt,
  speicherFehlerText,
  TECHNIK_TEXT,
  technikStand,
} from '@shared/gebetsabend/technik';
import { NACHFRAGEN_MS } from '@shared/gebetsabend/zuhoeren';
import { neuerZugang, type Zugang } from '@shared/gebetsabend/zugang';
import { NUR_TECHNIK_ZUGANG, port } from './speicher';
import type { Start } from './start';
import { Sender } from './Sender';
import { ZustandZeile } from './ZustandZeile';
import karte from './Zuhoeren.module.scss';
import styles from './Technik.module.scss';

interface Props {
  start: Start;
  /** ID der Kategorie „Zugang“. */
  kategorie: number;
  /** Womit der Sender auf DIESEM Gerät läuft – `null`: er läuft hier nicht (gehört der Seite, `App.tsx`). */
  gesendet: Zugang | null;
  onGesendet: (z: Zugang | null) => void;
  /** Etwas ist gespeichert – Zuhören soll sofort nachfragen, nicht erst nach 20 s. */
  onGeaendert: () => void;
  /** Öffnet die Einstellungen (Zahnrad) – nur, wer sie ändern darf. */
  onEinstellungen?: () => void;
}

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'da'; stand: Stand<Zugang | null> };

/**
 * **Die Technik-Karte** (Bauplan Gebetsabend G3/G4, Entwurf v3 vom 05.11.2026): starten, Sender auf diesem Gerät mit
 * „Wer hört zu?“ (`Sender.tsx`), neu starten, beenden – nur für die Technik (wer „Zugang“ bearbeiten darf).
 *
 * - **Ein Klick „Übertragung starten“:** neue StreamID + neues Passwort → speichern → **nachgelesen** → erst dann
 *   startet der Sender hier. Ein Fehler oder Konflikt startet nichts.
 * - Der Sender läuft als iframe in der Seite (G0-3) und startet **nie von selbst** (`@shared/gebetsabend/technik`).
 * - Die Karte fragt wie die Zuhörer alle 20 s nach. Hat ein anderes Gerät beendet oder neu gestartet, hört der Sender
 *   hier auf; ein vorübergehender Fehler ändert nichts.
 */
export function Technik({
  start,
  kategorie,
  gesendet,
  onGesendet,
  onGeaendert,
  onEinstellungen,
}: Props) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [mitBild, setMitBild] = useState(true);
  const [arbeitet, setArbeitet] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fragen, setFragen] = useState(false);
  /** Zählt „Sender neu starten“ hoch – ein neuer `key` lädt das iframe neu (gleiches Passwort). */
  const [lauf, setLauf] = useState(0);
  const gesendetRef = useRef(gesendet);
  useEffect(() => {
    gesendetRef.current = gesendet;
  }, [gesendet]);

  const uebernehmen = useCallback(
    (stand: Stand<Zugang | null>) => {
      setLaden({ art: 'da', stand });
      const hier = gesendetRef.current;
      if (hier && !senderBleibt(hier, stand.inhalt)) {
        onGesendet(null);
        setProblem(TECHNIK_TEXT.senderWeg);
      }
    },
    [onGesendet],
  );

  const nachfragen = useCallback(
    (erstesMal: boolean) => {
      zugangLesen(port, start.modul, kategorie).then(
        (l) => {
          if (l.ok) uebernehmen(l.stand);
          // Nur das erste Laden zeigt den Fehler; später bleibt der letzte Stand (vorübergehend ≠ beendet).
          else if (erstesMal)
            setLaden({
              art: 'fehler',
              text: speicherFehlerText(l.grund, 'geladen', KATEGORIE_ZUGANG.name),
            });
        },
        (e: unknown) => {
          if (erstesMal) setLaden({ art: 'fehler', text: fehlerMeldung(e).text });
        },
      );
    },
    [start.modul, kategorie, uebernehmen],
  );

  useEffect(() => {
    nachfragen(true);
    const t = window.setInterval(() => nachfragen(false), NACHFRAGEN_MS);
    return () => window.clearInterval(t);
  }, [nachfragen]);

  /** Speichern mit der gesehenen Version; danach gilt, was nachgelesen dasteht. */
  const speichern = async (z: Zugang, was: string): Promise<boolean> => {
    if (laden.art !== 'da') return false;
    setArbeitet(true);
    setProblem(null);
    try {
      const r = await zugangSpeichern(
        port,
        start.modul,
        kategorie,
        z,
        { personId: start.ichId, name: start.name || start.vorname },
        laden.stand.version,
        NUR_TECHNIK_ZUGANG,
      );
      if (r.ok) {
        setLaden({ art: 'da', stand: r.stand });
        onGeaendert();
        return true;
      }
      if (r.jetzt) uebernehmen(r.jetzt);
      setProblem(speicherFehlerText(r.grund, was, KATEGORIE_ZUGANG.name));
      return false;
    } catch (e) {
      // Modul nicht erreichbar – nichts geschrieben.
      setProblem(fehlerMeldung(e).text);
      return false;
    } finally {
      setArbeitet(false);
    }
  };

  const starten = async () => {
    const z = neuerZugang(mitBild, new Date().toISOString());
    if (await speichern(z, 'gestartet')) onGesendet(z);
  };

  const beenden = async () => {
    if (laden.art !== 'da' || !laden.stand.inhalt) return;
    if (await speichern(beendet(laden.stand.inhalt), 'beendet')) {
      setFragen(false);
      onGesendet(null);
    }
  };

  if (laden.art === 'laedt') return null;
  const zugang = laden.art === 'da' ? laden.stand.inhalt : null;
  const stand = technikStand(zugang, gesendet);

  return (
    <section className={karte.karte} aria-label="Übertragung">
      <h2 className={styles.kopf}>
        <span className={styles.titel}>Übertragung</span>
        <span className={styles.anm}>nur Technik</span>
        {onEinstellungen && (
          <KopfKnopf
            klein
            label="Einstellungen"
            symbol={<Icon name="zahnrad" />}
            onClick={onEinstellungen}
          />
        )}
      </h2>

      {laden.art === 'fehler' && <p className={karte.text}>{laden.text}</p>}

      {laden.art === 'da' && stand === 'aus' && (
        <>
          <ZustandZeile gut={false}>Nicht gestartet</ZustandZeile>
          <div className={styles.zeile}>
            <div className={styles.wer}>
              <b>Senden</b>
              <small>{TECHNIK_TEXT.bildHinweis}</small>
            </div>
            <Segment
              verbunden
              ariaLabel="Was gesendet wird"
              value={mitBild ? 'bild' : 'ton'}
              options={[
                { value: 'bild', label: 'Bild + Ton' },
                { value: 'ton', label: 'Nur Ton' },
              ]}
              onChange={(v) => setMitBild(v === 'bild')}
            />
          </div>
          <button
            type="button"
            className={karte.gross}
            disabled={arbeitet}
            onClick={() => void starten()}
          >
            <Icon name="play" />
            {arbeitet ? 'Wird gestartet …' : 'Übertragung starten'}
          </button>
          <p className={karte.leise}>{TECHNIK_TEXT.startHinweis}</p>
        </>
      )}

      {stand === 'hier' && gesendet && zugang?.laeuftSeit && (
        <>
          <ZustandZeile
            gut
          >{`Läuft seit ${uhrText(zugang.laeuftSeit)} Uhr · Sender auf diesem Gerät`}</ZustandZeile>
          <Sender
            key={`${gesendet.streamId}-${lauf}`}
            zugang={gesendet}
            mitte={
              <>
                <p className={karte.text}>
                  <b>{TECHNIK_TEXT.offenLassen}</b>
                </p>
                <div className={karte.rechts}>
                  <KopfKnopf
                    raster
                    label="Sender neu starten"
                    symbol={<Icon name="refresh" />}
                    onClick={() => setLauf((n) => n + 1)}
                  />
                  <KopfKnopf
                    raster
                    label="Übertragung beenden"
                    symbol={<Icon name="x" />}
                    disabled={arbeitet}
                    onClick={() => setFragen(true)}
                  />
                </div>
              </>
            }
          />
        </>
      )}

      {stand === 'woanders' && zugang?.laeuftSeit && (
        <>
          <ZustandZeile gut>{`Läuft seit ${uhrText(zugang.laeuftSeit)} Uhr`}</ZustandZeile>
          <p className={karte.text}>{TECHNIK_TEXT.woanders}</p>
          <div className={karte.rechts}>
            <KopfKnopf
              raster
              label="Sender hier starten"
              symbol={<Icon name="play" />}
              onClick={() => {
                setProblem(null);
                onGesendet(zugang);
              }}
            />
            <KopfKnopf
              raster
              label="Übertragung beenden"
              symbol={<Icon name="x" />}
              disabled={arbeitet}
              onClick={() => setFragen(true)}
            />
          </div>
          <p className={karte.leise}>{TECHNIK_TEXT.hierStartenHinweis}</p>
        </>
      )}

      {/* Im offenen Fenster steht der Fehler im Fenster – dahinter sähe man ihn nicht. */}
      {problem && !fragen && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      {fragen && (
        <ConfirmDialog
          title="Übertragung beenden?"
          message={TECHNIK_TEXT.beendenFrage}
          confirmLabel={arbeitet ? 'Wird beendet …' : 'Beenden'}
          beschaeftigt={arbeitet}
          onConfirm={() => void beenden()}
          onCancel={() => {
            setFragen(false);
            setProblem(null);
          }}
        >
          {problem && (
            <p className={styles.problem} role="alert">
              {problem}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
