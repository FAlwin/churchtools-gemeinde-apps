import type { ReactNode } from 'react';
import { tagPunkt } from '@shared/ct/datum';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import { statusText, type Aufgabe } from '@shared/protokolle/aufgaben';
import styles from './SitzungAnsicht.module.scss';

/**
 * **Die Bereiche unter dem Protokoll** – Beschlüsse · To-Dos · Termine, untereinander (entschieden 22.10.2026), alle aus
 * der EINEN Ableitung des Dokuments (Bauplan 3.2). Beim Lesen (S3-2) und beim Schreiben (S4-1, live während des
 * Tippens) dieselben – bis S4-1 standen sie nur in der Sitzungsansicht. Oben in „Termine“ steht die nächste Sitzung
 * (S5-2, `naechste`).
 */
export function Bereiche({
  dokument,
  aufgaben,
  naechste,
}: {
  dokument: readonly Block[];
  aufgaben: readonly Aufgabe[];
  /** „Nächste Sitzung“ (S5-2) oben im Bereich Termine. */
  naechste?: ReactNode;
}) {
  const a = ableiten(dokument);
  const punktText = (id: string | null): string => {
    const p = a.punkte.find((x) => x.blockId === id);
    return p ? `Punkt ${p.nummer} · ${p.titel}` : 'vor dem ersten Punkt';
  };
  const aufgabeVon = new Map(aufgaben.map((x) => [x.id, x]));
  return (
    <>
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
                    {g ? ` · ${statusText(g.status)}` : ''}
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
        {naechste}
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
  );
}
