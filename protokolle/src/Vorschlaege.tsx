import { useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { darfAendern, vorschlaegeOrdnen, type Vorschlag } from '@shared/protokolle/vorschlaege';
import { wannLang } from './anzeige';
import { Marke } from './Marke';
import styles from './Vorschlaege.module.scss';

/** Was man mit einem Vorschlag tun kann – fehlt eine Aktion, gibt es den Knopf nicht. */
export interface VorschlagAktionen {
  /** Wer vorschlug: ändern (Fenster) und zurückziehen. */
  aendern?: (v: Vorschlag) => void;
  zurueckziehen?: (v: Vorschlag) => Promise<void>;
  /** Die Leitung (Gruppe „Vorschlagen“): übernehmen, aufs nächste Mal, ablehnen (Fenster). */
  uebernehmen?: (v: Vorschlag) => Promise<void>;
  naechstesMal?: (v: Vorschlag) => Promise<void>;
  ablehnen?: (v: Vorschlag) => void;
}

function standMarke(v: Vorschlag, direkt: boolean): ReactNode {
  switch (v.stand) {
    case 'offen':
      return direkt ? (
        <Marke art="info">kommt ins Protokoll</Marke>
      ) : (
        <Marke art="leise">offen</Marke>
      );
    case 'angenommen':
      return <Marke art="gut">übernommen</Marke>;
    case 'imProtokoll':
      return <Marke art="gut">im Protokoll</Marke>;
    case 'abgelehnt':
      return <Marke art="problem">abgelehnt</Marke>;
    case 'zurueckgezogen':
      return null;
  }
}

/**
 * **Ein Vorschlag als Zeile** – Thema, Text, von wem, Stand (S5-4). Die Knöpfe hängen an `aktionen`: eigene offene
 * Vorschläge ändern/zurückziehen, die Leitung entscheidet. Läuft eine Aktion, sind die Knöpfe der Zeile gesperrt.
 */
export function VorschlagZeile({
  v,
  ich,
  direkt,
  aktionen,
  ohneMarke = false,
}: {
  v: Vorschlag;
  ich: number;
  direkt: boolean;
  aktionen: VorschlagAktionen;
  /** Im Kasten beim Schreiben: alle offen – das Schild sagte nichts. */
  ohneMarke?: boolean;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const tun = (f?: (v: Vorschlag) => Promise<void>) => () => {
    if (!f) return;
    setLaeuft(true);
    void f(v).finally(() => setLaeuft(false));
  };
  const meins = v.von === ich;
  const eigen = darfAendern(v, ich);
  const verschoben = v.stand === 'offen' && v.verlauf[v.verlauf.length - 1]?.art === 'verschoben';
  const entscheiden = v.stand === 'offen' && !direkt;
  const knoepfe = [
    eigen && aktionen.aendern && (
      <button
        key="a"
        type="button"
        className={styles.knopf}
        disabled={laeuft}
        onClick={() => aktionen.aendern!(v)}
      >
        Ändern
      </button>
    ),
    eigen && aktionen.zurueckziehen && (
      <button
        key="z"
        type="button"
        className={`${styles.knopf} ${styles.rot}`}
        disabled={laeuft}
        onClick={tun(aktionen.zurueckziehen)}
      >
        Zurückziehen
      </button>
    ),
    entscheiden && aktionen.uebernehmen && (
      <button
        key="u"
        type="button"
        className={`${styles.knopf} ${styles.blau}`}
        disabled={laeuft}
        onClick={tun(aktionen.uebernehmen)}
      >
        Übernehmen
      </button>
    ),
    entscheiden && aktionen.naechstesMal && (
      <button
        key="n"
        type="button"
        className={styles.knopf}
        disabled={laeuft}
        onClick={tun(aktionen.naechstesMal)}
      >
        Nächstes Mal
      </button>
    ),
    entscheiden && aktionen.ablehnen && (
      <button
        key="x"
        type="button"
        className={`${styles.knopf} ${styles.rot}`}
        disabled={laeuft}
        onClick={() => aktionen.ablehnen!(v)}
      >
        Ablehnen
      </button>
    ),
  ].filter(Boolean);
  return (
    <li className={styles.vorschlag}>
      <div className={styles.oben}>
        <div className={styles.inhalt}>
          <b>{v.titel}</b>
          {v.text && <p>{v.text}</p>}
          <small>
            von {v.name}
            {meins ? ' (du)' : ''}
            {verschoben ? ' · verschoben' : ''}
          </small>
        </div>
        {!ohneMarke && standMarke(v, direkt)}
      </div>
      {v.stand === 'abgelehnt' && v.grund && <p className={styles.grund}>{v.grund}</p>}
      {knoepfe.length > 0 && <div className={styles.knoepfe}>{knoepfe}</div>}
    </li>
  );
}

/**
 * **Karte „Vorschläge“** im Reiter „Sitzungen“ (S5-4, Entwurf v1): alle Vorschläge der Gruppe, je kommende Sitzung, dann
 * „Nächste Sitzung“ (noch nicht festgelegt), dann „Erledigt“. Die Leitung kann offene Vorschläge einer festgelegten
 * Sitzung schon hier übernehmen – eingefügt wird beim Öffnen des Protokolls.
 */
export function VorschlaegeKarte({
  liste,
  kommend,
  heute,
  zeitzone,
  ich,
  direkt,
  aktionen,
  fehler,
}: {
  liste: readonly Vorschlag[];
  kommend: readonly Sitzung[];
  heute: string;
  zeitzone: string;
  ich: number;
  direkt: boolean;
  /** Die Aktionen für eine Sitzung – ohne Sitzung („Nächste Sitzung“) gibt es nichts zu übernehmen. */
  aktionen: (s: Sitzung | null) => VorschlagAktionen;
  fehler: string | null;
}) {
  const { gruppen, erledigt } = vorschlaegeOrdnen(liste, kommend, heute, zeitzone);
  const offen = liste.filter((v) => v.stand === 'offen').length;
  return (
    <section className={styles.karte} aria-labelledby="vorschlaege">
      <div className={styles.kartenkopf}>
        <h3 id="vorschlaege">Vorschläge</h3>
        <span className={styles.anzahl}>{offen} offen</span>
      </div>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {!gruppen.length && !erledigt.length && (
        <p className={styles.leer}>
          Noch keine Vorschläge. Mit „Punkt vorschlagen“ bringst du ein Thema für eine Sitzung ein.
        </p>
      )}
      {gruppen.map((g) => (
        <div key={g.sitzung?.schluessel ?? 'naechste'}>
          <div className={styles.gruppe}>
            Für{' '}
            {g.sitzung
              ? `${g.sitzung.titel} · ${wannLang(g.sitzung.beginn, zeitzone)}`
              : 'die nächste Sitzung · noch nicht festgelegt'}
          </div>
          <ul className={styles.liste}>
            {g.vorschlaege.map((v) => (
              <VorschlagZeile
                key={v.id}
                v={v}
                ich={ich}
                direkt={direkt}
                aktionen={aktionen(g.sitzung)}
              />
            ))}
          </ul>
        </div>
      ))}
      {erledigt.length > 0 && (
        <div>
          <div className={styles.gruppe}>Erledigt</div>
          <ul className={styles.liste}>
            {erledigt.map((v) => (
              <VorschlagZeile key={v.id} v={v} ich={ich} direkt={direkt} aktionen={{}} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * **Kasten „Vorschläge · n“** beim Schreiben (S5-4, Gruppe „Vorschlagen“): die offenen Vorschläge dieser Sitzung mit
 * Übernehmen / Nächstes Mal / Ablehnen; aufklappbar. Ohne offene Vorschläge steht er nicht da.
 */
export function VorschlaegeKasten({
  liste,
  ich,
  aktionen,
  fehler,
}: {
  liste: readonly Vorschlag[];
  ich: number;
  aktionen: VorschlagAktionen;
  fehler: string | null;
}) {
  const [offen, setOffen] = useState(true);
  if (!liste.length && !fehler) return null;
  return (
    <section className={styles.karte} aria-label="Vorschläge">
      <button
        type="button"
        className={styles.klapp}
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
      >
        <Icon name={offen ? 'chev-down' : 'chev-right'} size={16} />
        Vorschläge <span className={styles.anzahl}>· {liste.length}</span>
      </button>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {offen && liste.length > 0 && (
        <ul className={styles.liste}>
          {liste.map((v) => (
            <VorschlagZeile
              key={v.id}
              v={v}
              ich={ich}
              direkt={false}
              aktionen={aktionen}
              ohneMarke
            />
          ))}
        </ul>
      )}
    </section>
  );
}
