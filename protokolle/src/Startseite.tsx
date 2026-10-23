import { useCallback, useEffect, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Icon } from '@ui/icons/icons';
import { datumText, tagKurz } from '@shared/ct/datum';
import { heuteImKalender, tagAusIso } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { istUeberfaellig, meineOffenen, offene, type Aufgabe } from '@shared/protokolle/aufgaben';
import {
  meineAntwort,
  naechsteSitzungen,
  type Antwort,
  type Sitzung,
} from '@shared/protokolle/sitzungen';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { kachelVon, uhrzeit } from './anzeige';
import { Marke } from './Marke';
import styles from './Startseite.module.scss';

const LAGE: Record<ProtokollGruppe['lage'], { text: string; art: 'gut' | 'problem' }> = {
  eingerichtet: { text: 'eingerichtet', art: 'gut' },
  unvollstaendig: { text: 'unvollständig eingerichtet', art: 'problem' },
};

const ANTWORT_TEXT: Record<Antwort, string> = {
  zugesagt: 'du hast zugesagt',
  abgesagt: 'du hast abgesagt',
  vielleicht: 'du hast „vielleicht“ gesagt',
  offen: 'noch nicht beantwortet',
};

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; uebersicht: GruppenUebersicht[] };

const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface StartseiteProps {
  modul: number;
  /** Personen-ID – für „meine“ To-Dos und „du hast zugesagt“. */
  ich: number;
  gruppen: ProtokollGruppe[];
  /** Eine Sitzung im Reiter „Sitzungen“ öffnen. */
  onSitzung: (gruppe: number, sitzung: string) => void;
  /** Den Reiter „Sitzungen“ mit dieser Gruppe öffnen. */
  onGruppe: (gruppe: number) => void;
}

/** „2 von 5 zugesagt“ – gezählt über die Besprechungsanfragen des Termins; ohne Anfragen nichts. */
function zusagen(s: Sitzung): string {
  if (!s.anfragen.length) return '';
  const ja = s.anfragen.filter((a) => a.antwort === 'zugesagt').length;
  return ` · ${ja} von ${s.anfragen.length} zugesagt`;
}

/** Aus welcher Sitzung ein To-Do stammt – nur, wenn sie in der geladenen Übersicht steht. */
function herkunft(a: Aufgabe, u: GruppenUebersicht): Sitzung | null {
  return (
    [...u.sitzungen.kommend, ...u.sitzungen.protokolle].find(
      (s) => s.kopf?.sitzung === a.sitzung,
    ) ?? null
  );
}

/**
 * **Startseite der Protokolle** (Bauplan S1/S3-3, Entwurf 7): links „Heute“ (wenn heute eine Sitzung ansteht) und
 * „Meine offenen To-Dos“, rechts „Nächste Sitzungen“ und „Deine Gruppen“ (nur Gruppen mit Zugriff, S2-4). Was über
 * die Gruppen hinweg gelesen wird, lädt nach dem Gruß; scheitert es, gibt es „Erneut versuchen“ statt leerer Listen.
 */
export function Startseite({ modul, ich, gruppen, onSitzung, onGruppe }: StartseiteProps) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const heute = heuteImKalender();

  const laden = useCallback(() => {
    if (!gruppen.length) return setZustand({ art: 'fertig', uebersicht: [] });
    setZustand({ art: 'laedt' });
    ladeUebersicht(modul, gruppen, zeitzone).then(
      (uebersicht) => setZustand({ art: 'fertig', uebersicht }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppen]);

  useEffect(laden, [laden]);

  const ue = zustand.art === 'fertig' ? zustand.uebersicht : [];
  const anstehend = naechsteSitzungen(
    ue.map((u) => ({ gruppe: u.gruppe, kommend: u.sitzungen.kommend })),
    heute,
    zeitzone,
  );
  const jetzt = anstehend.find((n) => tagAusIso(n.sitzung.beginn, zeitzone) === heute) ?? null;
  const naechste = anstehend.filter((n) => n !== jetzt);
  const meine = ue.flatMap((u) => meineOffenen(u.aufgaben, ich, heute).map((a) => ({ a, u })));

  const ladeTeil =
    zustand.art === 'laedt' ? (
      <p className={styles.innen}>Wird geladen …</p>
    ) : zustand.art === 'fehler' ? (
      <div className={styles.innen}>
        <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />
      </div>
    ) : null;

  return (
    <div className={styles.raster}>
      <div className={styles.spalte}>
        {jetzt && (
          <section className={`${styles.karte} ${styles.heute}`} aria-label="Heute">
            <div className={styles.heuteKopf}>
              <DatumKachel {...kachelVon(jetzt.sitzung.beginn, zeitzone)} />
              <div>
                <span className={styles.heuteMarke}>Heute</span>
                <h2>
                  {jetzt.sitzung.titel} · {jetzt.gruppe.name}
                </h2>
                <p>
                  {uhrzeit(jetzt.sitzung.beginn, zeitzone)}
                  {zusagen(jetzt.sitzung)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={styles.hauptknopf}
              onClick={() => onSitzung(jetzt.gruppe.id, jetzt.sitzung.schluessel)}
            >
              Sitzung öffnen
            </button>
          </section>
        )}

        <section className={styles.karte} aria-labelledby="meine-todos">
          <div className={styles.kopf}>
            <h2 id="meine-todos">Meine offenen To-Dos</h2>
            {zustand.art === 'fertig' && <span className={styles.anzahl}>{meine.length}</span>}
          </div>
          {ladeTeil}
          {zustand.art === 'fertig' &&
            (meine.length ? (
              <ul className={styles.liste}>
                {meine.map(({ a, u }) => {
                  const s = herkunft(a, u);
                  const ueber = istUeberfaellig(a, heute);
                  const inhalt = (
                    <>
                      <Icon name={a.status === 'arbeit' ? 'refresh' : 'clock'} size={18} />
                      <span className={styles.text}>
                        <b>{a.text}</b>
                        <small>
                          {u.gruppe.name}
                          {a.status === 'arbeit' ? ' · in Arbeit' : ''}
                          {s ? ` · aus „${s.titel}“` : ''}
                        </small>
                      </span>
                      {a.bis && (
                        <span className={ueber ? styles.ueberfaellig : styles.frist}>
                          {ueber ? 'überfällig · ' : 'bis '}
                          {tagKurz(a.bis)}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={`${u.gruppe.id}:${a.id}`}>
                      {s ? (
                        <button
                          type="button"
                          className={styles.zeile}
                          onClick={() => onSitzung(u.gruppe.id, s.schluessel)}
                        >
                          {inhalt}
                        </button>
                      ) : (
                        <div className={`${styles.zeile} ${styles.still}`}>{inhalt}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.innen}>Nichts offen. Schön!</p>
            ))}
        </section>
      </div>

      <div className={styles.spalte}>
        <section className={styles.karte} aria-labelledby="naechste">
          <div className={styles.kopf}>
            <h2 id="naechste">Nächste Sitzungen</h2>
          </div>
          {ladeTeil}
          {zustand.art === 'fertig' &&
            (naechste.length ? (
              <ul className={styles.liste}>
                {naechste.map((n) => {
                  const antwort = meineAntwort(n.sitzung, ich);
                  return (
                    <li key={`${n.gruppe.id}:${n.sitzung.schluessel}`}>
                      <button
                        type="button"
                        className={styles.zeile}
                        onClick={() => onSitzung(n.gruppe.id, n.sitzung.schluessel)}
                      >
                        <DatumKachel {...kachelVon(n.sitzung.beginn, zeitzone)} />
                        <span className={styles.text}>
                          <b>{n.gruppe.name}</b>
                          <small>
                            {n.sitzung.titel} · {datumText(tagAusIso(n.sitzung.beginn, zeitzone))} ·{' '}
                            {uhrzeit(n.sitzung.beginn, zeitzone)}
                            {antwort ? ` · ${ANTWORT_TEXT[antwort]}` : ''}
                          </small>
                        </span>
                        <Icon name="chev-right" size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.innen}>Keine geplant.</p>
            ))}
        </section>

        <section className={styles.karte} aria-labelledby="deine-gruppen">
          <div className={styles.kopf}>
            <h2 id="deine-gruppen">Deine Gruppen</h2>
            <span className={styles.anzahl}>{gruppen.length}</span>
          </div>
          {gruppen.length === 0 ? (
            <p className={styles.innen}>
              Du bist in keiner Gruppe, die hier Protokolle führen kann.
            </p>
          ) : (
            <ul className={styles.liste}>
              {gruppen.map((g) => {
                const u = ue.find((x) => x.gruppe.id === g.id);
                const zahl = u ? offene(u.aufgaben, heute).length : null;
                return (
                  <li key={g.id}>
                    <button type="button" className={styles.zeile} onClick={() => onGruppe(g.id)}>
                      <span className={styles.text}>
                        <b>{g.name}</b>
                        {/* Schild unter dem Namen: in der schmalen Spalte bleibt so der Name ganz. */}
                        <span className={styles.unter}>
                          {zahl !== null && (
                            <small>
                              {zahl === 1 ? '1 offenes To-Do' : `${zahl} offene To-Dos`}
                            </small>
                          )}
                          <Marke art={LAGE[g.lage].art}>{LAGE[g.lage].text}</Marke>
                        </span>
                      </span>
                      <Icon name="chev-right" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Gruppen ohne Zugriff stehen nicht in der Liste (S2-4) – deshalb immer dieser Hinweis. */}
          <p className={styles.fuss}>
            Fehlt eine Gruppe? Ein Admin richtet sie ein oder gibt dir Zugriff.
          </p>
        </section>
      </div>
    </div>
  );
}
