import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { ableiten } from '@shared/protokolle/dokument';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { wannLang } from './anzeige';
import { Marke } from './Marke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import styles from './SitzungAnsicht.module.scss';

/**
 * **Eine Sitzung ansehen** (Bauplan S3-2, Entwurf 7) – oben Titel und Stand, darunter das Protokoll als Dokument und
 * die Bereiche Beschlüsse · To-Dos · Termine aus derselben Ableitung (Bauplan 3.2). Nur lesen; Schreiben kommt mit
 * S4, „Protokoll beginnen“ mit S5.
 */
export function SitzungAnsicht({
  sitzung,
  gruppe,
  teile,
  aufgaben,
  zeitzone,
  onZurueck,
}: {
  sitzung: Sitzung;
  gruppe: string;
  teile: readonly ProtokollTeil[];
  aufgaben: readonly Aufgabe[];
  zeitzone: string;
  onZurueck: () => void;
}) {
  const kopf = sitzung.kopf;
  const dokument = dokumentDerSitzung(kopf, teile);
  const a = dokument ? ableiten(dokument) : null;
  const punktText = (id: string | null): string => {
    const p = a?.punkte.find((x) => x.blockId === id);
    return p ? `Punkt ${p.nummer} · ${p.titel}` : 'vor dem ersten Punkt';
  };
  const aufgabeVon = new Map(aufgaben.map((x) => [x.id, x]));

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

      {dokument && a && (
        <>
          <section className={styles.karte} aria-label="Protokoll">
            <ProtokollAnsicht dokument={dokument} aufgaben={aufgaben} />
          </section>
          <section className={styles.karte} aria-labelledby="beschluesse">
            <h3 id="beschluesse">
              Beschlüsse <span className={styles.anzahl}>{a.beschluesse.length}</span>
            </h3>
            {a.beschluesse.length ? (
              <ul className={styles.liste}>
                {a.beschluesse.map((b) => (
                  <li key={b.blockId}>
                    <span>{b.text}</span>
                    <small>{punktText(b.punkt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.leer}>Keine Beschlüsse.</p>
            )}
          </section>
          <section className={styles.karte} aria-labelledby="todos">
            <h3 id="todos">
              To-Dos <span className={styles.anzahl}>{a.aufgaben.length}</span>
            </h3>
            {a.aufgaben.length ? (
              <ul className={styles.liste}>
                {a.aufgaben.map((x) => {
                  const g = x.aufgabe ? aufgabeVon.get(x.aufgabe) : undefined;
                  return (
                    <li key={x.blockId}>
                      <span>{x.text}</span>
                      <small>
                        {punktText(x.punkt)}
                        {g ? ` · ${g.status === 'arbeit' ? 'in Arbeit' : g.status}` : ''}
                        {g?.bis ? ` · bis ${tagPunkt(g.bis)}` : ''}
                      </small>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.leer}>Keine To-Dos.</p>
            )}
          </section>
          <section className={styles.karte} aria-labelledby="termine">
            <h3 id="termine">
              Termine <span className={styles.anzahl}>{a.termine.length}</span>
            </h3>
            {a.termine.length ? (
              <ul className={styles.liste}>
                {a.termine.map((t) => (
                  <li key={t.blockId}>
                    <span>
                      {t.datum ? `${tagPunkt(t.datum)} – ` : ''}
                      {t.text}
                    </span>
                    <small>{punktText(t.punkt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.leer}>Keine Termine.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
