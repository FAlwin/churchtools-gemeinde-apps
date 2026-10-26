import { useEffect } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { wannLang } from './anzeige';
import { Marke } from './Marke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { Bereiche } from './Bereiche';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import styles from './SitzungAnsicht.module.scss';

/**
 * **Eine Sitzung ansehen** (Bauplan S3-2, Entwurf 7) – oben Titel und Stand, darunter das Protokoll als Dokument und
 * die Bereiche Beschlüsse · To-Dos · Termine aus derselben Ableitung (Bauplan 3.2). Nur lesen; Schreiben kommt mit
 * S4, „Protokoll beginnen“ mit S5. Kommt man aus der Suche (S3-4b), springt die Ansicht zum Tagesordnungspunkt des
 * Treffers und hebt ihn kurz hervor.
 */
export function SitzungAnsicht({
  sitzung,
  gruppe,
  gruppeId,
  protokolle,
  teile,
  aufgaben,
  zeitzone,
  springeZu = null,
  onZurueck,
}: {
  sitzung: Sitzung;
  gruppe: string;
  gruppeId: number;
  /** Die freigegebenen Protokolle der Gruppe – für den festen Punkt „Letztes Protokoll“ (S4-3a). */
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  aufgaben: readonly Aufgabe[];
  zeitzone: string;
  /** Block-ID des Tagesordnungspunkts, zu dem gesprungen wird. */
  springeZu?: string | null;
  onZurueck: () => void;
}) {
  const kopf = sitzung.kopf;
  const dokument = dokumentDerSitzung(kopf, teile);

  // Zum Punkt springen, sobald er da ist. Effekt-Rumpf mit { } – `scrollIntoView` liefert in neuen Browsern ein
  // Promise, und ein zurückgegebenes Promise hielte React für die Aufräum-Funktion (Chrome 152, weiße Seite).
  useEffect(() => {
    if (!springeZu) return;
    document.getElementById(`punkt-${springeZu}`)?.scrollIntoView?.({ block: 'start' });
  }, [springeZu]);

  return (
    <div className={styles.seite}>
      <button type="button" className={styles.zurueck} onClick={onZurueck}>
        <Icon name="chev-left" size={18} />
        Sitzungen
      </button>
      <header className={styles.kopf}>
        <h2>
          {sitzung.titel} · {gruppe}
        </h2>
        <p>{wannLang(sitzung.beginn, zeitzone)}</p>
        <div className={styles.marken}>
          {!kopf && <Marke art="leise">noch kein Protokoll</Marke>}
          {kopf?.status === 'geplant' && <Marke art="leise">geplant</Marke>}
          {kopf?.status === 'entwurf' && (
            <Marke art="leise">Entwurf – noch nicht freigegeben</Marke>
          )}
          {kopf?.status === 'frei' && (
            <Marke art="gut">
              freigegeben{kopf.freigabe ? ` am ${tagPunkt(kopf.freigabe.am.slice(0, 10))}` : ''}
            </Marke>
          )}
        </div>
      </header>

      {!kopf && (
        <p className={styles.hinweis}>
          Für diese Sitzung gibt es noch kein Protokoll. Die Leitung beginnt es, sobald die Sitzung
          ansteht.
        </p>
      )}
      {kopf?.status === 'geplant' && (
        <p className={styles.hinweis}>Das Protokoll ist geplant, aber noch nicht begonnen.</p>
      )}
      {kopf && kopf.status !== 'geplant' && !dokument && (
        <p className={styles.fehler} role="alert">
          Das Protokoll ist gerade nicht vollständig lesbar (es wird vielleicht in diesem Moment
          gespeichert). Bitte gleich noch einmal öffnen.
        </p>
      )}

      {dokument && (
        <FestePunkteRahmen
          sitzung={sitzung}
          gruppe={gruppeId}
          protokolle={protokolle}
          teile={teile}
          aufgaben={aufgaben}
          zeitzone={zeitzone}
        >
          <section className={styles.karte} aria-label="Protokoll">
            <ProtokollAnsicht dokument={dokument} aufgaben={aufgaben} markiert={springeZu} />
          </section>
          <Bereiche dokument={dokument} aufgaben={aufgaben} />
        </FestePunkteRahmen>
      )}
    </div>
  );
}
