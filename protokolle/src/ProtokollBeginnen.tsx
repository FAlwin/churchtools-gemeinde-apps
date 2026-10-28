import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import { anfangsDokument, type Anfang } from '@shared/protokolle/beginnen';
import { letztesProtokoll } from '@shared/protokolle/festePunkte';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Vorlage } from '@shared/protokolle/vorlagen';
import { protokollBeginnen } from './beginnen';
import { ladeVorlagen } from './vorlagen';
import { wannLang } from './anzeige';
import styles from './ProtokollBeginnen.module.scss';

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorlagen: Vorlage[] };

/** Die Tagesordnungspunkte eines Dokuments – für die kleine Zeile unter jeder Wahl. */
const punkte = (dok: readonly Block[]): string =>
  ableiten(dok)
    .punkte.map((p) => p.titel)
    .join(' · ');

/**
 * **Fenster „Protokoll beginnen“** (Bauplan S5-1, Entwurf 7) – für die Leitung bei einer Sitzung ohne Protokoll (oder
 * einer geplanten): eine **Vorlage**, **„Wie letztes Mal“** (Tagesordnung des letzten freigegebenen Protokolls) oder
 * **leer**. Danach öffnet sich das Protokoll im Editor. Hat inzwischen jemand anderes begonnen, sagt das Fenster das
 * und öffnet dessen Protokoll.
 */
export function ProtokollBeginnen({
  sitzung,
  gruppeId,
  modul,
  kategorie,
  mitarbeit,
  protokolle,
  teile,
  ich,
  zeitzone,
  onBegonnen,
  onClose,
}: {
  sitzung: Sitzung;
  gruppeId: number;
  modul: number;
  kategorie: number;
  mitarbeit: number | null;
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  ich: { person: number };
  zeitzone: string;
  /** Begonnen (oder schon da) – die Sitzung wird mit diesem Protokoll geöffnet. */
  onBegonnen: (sitzung: string) => void;
  onClose: () => void;
}) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [wahl, setWahl] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [ende, setEnde] = useState<{ sitzung: string; text: string } | null>(null);

  const letztes = useMemo(() => {
    const s = letztesProtokoll(protokolle, sitzung);
    const dok = s ? dokumentDerSitzung(s.kopf, teile) : null;
    return s && dok ? { sitzung: s, dokument: dok } : null;
  }, [protokolle, sitzung, teile]);

  useEffect(() => {
    let aktiv = true;
    ladeVorlagen(modul).then(
      ({ vorlagen }) => {
        if (!aktiv) return;
        const liste = vorlagen.map((v) => v.vorlage);
        setLaden({ art: 'fertig', vorlagen: liste });
        // Vorbelegt: „Wie letztes Mal“, wenn es ein letztes Protokoll gibt – sonst die erste Vorlage.
        setWahl((w) => w ?? (letztes ? 'letztes' : liste[0] ? `v:${liste[0].id}` : 'leer'));
      },
      (e: unknown) => aktiv && setLaden({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktiv = false;
    };
  }, [modul, letztes]);

  const anfang = (): Anfang | null => {
    if (wahl === 'leer') return { art: 'leer' };
    if (wahl === 'letztes') return letztes ? { art: 'letztes', dokument: letztes.dokument } : null;
    const v = laden.art === 'fertig' ? laden.vorlagen.find((x) => `v:${x.id}` === wahl) : undefined;
    return v ? { art: 'vorlage', vorlage: v } : null;
  };

  const beginnen = () => {
    const a = anfang();
    if (!a) return;
    setLaeuft(true);
    setFehler(null);
    protokollBeginnen({
      modul,
      kategorie,
      mitarbeit: mitarbeit === null ? null : { modul, kategorie: mitarbeit },
      gruppe: gruppeId,
      sitzung,
      dokument: anfangsDokument(a, () => crypto.randomUUID()),
      von: ich.person,
    }).then(
      (r) => {
        setLaeuft(false);
        if (r.art === 'schon')
          setEnde({
            sitzung: r.sitzung,
            text: 'Inzwischen hat jemand anderes dieses Protokoll begonnen – deine Wahl wurde nicht übernommen.',
          });
        else if (r.hinweis) setEnde({ sitzung: r.sitzung, text: r.hinweis });
        else onBegonnen(r.sitzung);
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  const wahlKnopf = (id: string, titel: string, klein: string) => (
    <button
      key={id}
      type="button"
      className={styles.wahl}
      aria-pressed={wahl === id}
      disabled={laeuft}
      onClick={() => setWahl(id)}
    >
      <b>{titel}</b>
      <small>{klein}</small>
    </button>
  );

  return (
    <Sheet
      title="Protokoll beginnen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        ende ? (
          <FensterKnopf onClick={() => onBegonnen(ende.sitzung)}>Protokoll öffnen</FensterKnopf>
        ) : laden.art === 'fertig' && wahl ? (
          <FensterKnopf disabled={laeuft} onClick={beginnen}>
            {laeuft ? 'Wird angelegt …' : 'Beginnen'}
          </FensterKnopf>
        ) : null
      }
    >
      <p className={styles.unter}>
        {sitzung.titel} · {wannLang(sitzung.beginn, zeitzone)}
      </p>
      {ende && (
        <p className={styles.hinweis} role="status">
          {ende.text}
        </p>
      )}
      {!ende && laden.art === 'laedt' && <p className={styles.unter}>Vorlagen werden geladen …</p>}
      {!ende && laden.art === 'fehler' && (
        <p className={styles.fehler} role="alert">
          {laden.fehler.text}
        </p>
      )}
      {!ende && laden.art === 'fertig' && (
        <div className={styles.liste} role="group" aria-label="Womit beginnen?">
          {laden.vorlagen.map((v) => wahlKnopf(`v:${v.id}`, v.name, punkte(v.bloecke)))}
          {letztes &&
            wahlKnopf(
              'letztes',
              'Wie letztes Mal',
              `Tagesordnung vom ${tagPunkt(tagAusIso(letztes.sitzung.beginn, zeitzone))}: ${punkte(letztes.dokument)}`,
            )}
          {wahlKnopf('leer', 'Leer', 'Ohne Vorlage beginnen')}
        </div>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
