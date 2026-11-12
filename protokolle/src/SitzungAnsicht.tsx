import { useEffect, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { wannLang } from './anzeige';
import { Marke } from './Marke';
import { FreigabeMarke, ZurueckVermerk } from './FreigabeVermerk';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { Bereiche } from './Bereiche';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import styles from './SitzungAnsicht.module.scss';

/**
 * **Eine Sitzung ansehen** (Bauplan S3-2, Entwurf 7) – oben Titel und Stand, darunter das Protokoll als Dokument und
 * die Bereiche Beschlüsse · To-Dos · Termine aus derselben Ableitung (Bauplan 3.2). Nur lesen; geschrieben wird im
 * Editor (S4). Ohne Protokoll bietet sie der Leitung „Protokoll beginnen“ an (S5-1), dazu „Bearbeiten“ (K2b). Kommt man aus der Suche (S3-4b),
 * springt die Ansicht zum Tagesordnungspunkt des Treffers und hebt ihn kurz hervor.
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
  naechste,
  onBeginnen,
  onBearbeiten,
  onZuruecknehmen,
  onZurueck,
  onZuSitzung,
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
  /** „Nächste Sitzung“ im Bereich Termine (S5-2). */
  naechste?: ReactNode;
  /** Nur für die Leitung (S5-1): Protokoll zu dieser Sitzung beginnen – fehlt, wenn man nicht schreiben darf. */
  onBeginnen?: () => void;
  /** Nur für die Leitung (K2b): Titel, Zeit, Eingeladene ändern oder absagen – fehlt bei freigegebenen Protokollen. */
  onBearbeiten?: () => void;
  /** Nur für die Leitung (S6-1): „Freigabe zurücknehmen“ bei einem freigegebenen Protokoll. */
  onZuruecknehmen?: () => void;
  onZurueck: () => void;
  /** „Öffnen“ im Fenster eines früheren Protokolls: zu dieser Sitzung springen (K3b-2). */
  onZuSitzung?: (s: Sitzung) => void;
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
          {kopf?.status === 'frei' && <FreigabeMarke kopf={kopf} zeitzone={zeitzone} />}
        </div>
        {(onBearbeiten || onZuruecknehmen) && (
          <div className={styles.aktionen}>
            {onBearbeiten && (
              <KopfKnopf
                label="Bearbeiten"
                title="Sitzung bearbeiten (Zeit, Titel, Eingeladene, absagen)"
                symbol={<Icon name="pencil" size={16} />}
                onClick={onBearbeiten}
              />
            )}
            {onZuruecknehmen && kopf?.status === 'frei' && (
              <KopfKnopf
                label="Freigabe zurücknehmen"
                title="Freigabe zurücknehmen – wieder Entwurf"
                symbol={<Icon name="undo" size={16} />}
                onClick={onZuruecknehmen}
              />
            )}
          </div>
        )}
      </header>
      <ZurueckVermerk kopf={kopf} zeitzone={zeitzone} />

      {!kopf && (
        <p className={styles.hinweis}>
          Für diese Sitzung gibt es noch kein Protokoll.
          {onBeginnen ? '' : ' Die Leitung beginnt es, sobald die Sitzung ansteht.'}
        </p>
      )}
      {kopf?.status === 'geplant' && (
        <p className={styles.hinweis}>Das Protokoll ist geplant, aber noch nicht begonnen.</p>
      )}
      {onBeginnen && (!kopf || kopf.status === 'geplant') && (
        <div>
          <button type="button" className={styles.beginnen} onClick={onBeginnen}>
            <Icon name="pencil" size={18} />
            Protokoll beginnen
          </button>
        </div>
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
          onZuSitzung={onZuSitzung}
        >
          <section className={styles.karte} aria-label="Protokoll">
            <ProtokollAnsicht dokument={dokument} aufgaben={aufgaben} markiert={springeZu} />
          </section>
          <Bereiche dokument={dokument} aufgaben={aufgaben} naechste={naechste} />
        </FestePunkteRahmen>
      )}
    </div>
  );
}
