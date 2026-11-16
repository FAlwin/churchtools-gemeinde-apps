import { useMemo, useRef } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useKopieren } from '@ui/bedienung/useKopieren';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import type { Sommerferien, Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { GruppenSicht, Phase } from '@shared/organigramm/gruppenwechselSicht';
import {
  leitungenNachricht,
  tageHinweis,
  wechseltagText,
  type JahrStand,
  type TageStand,
} from '@shared/organigramm/wechseltage';
import { Hinweis } from './KjHinweis';
import type { RegelStand } from './ladeRegelStand';
import styles from './KinderJugend.module.scss';

/**
 * **Die Seite „Wechseltage“** (Bauplan O9-4, Entwurf `kj-gruppenwechsel-v1`, O9-F8) – für Bereichsleitung und Admins:
 * wann die Kinder wechseln und der Text, den man den Leitungen schickt.
 *
 * Wer „Berechtigungen verwalten“ hat (`regel` ist nicht `null`), sieht zusätzlich die Spalte „In ChurchTools“ – gelesen
 * aus den Regeln selbst, es gibt keine zweite Quelle – und die Erinnerung, wenn die Regeln auslaufen. Die
 * Bereichsleitung ohne das Recht sieht weder Spalte noch Erinnerung. Ließen sich die Regeln nicht lesen, steht „nicht
 * prüfbar“ und ein ruhiger Hinweis, aber keine Erinnerung.
 */
export function Wechseltage({
  einrichtung,
  jahr,
  jahre,
  ferien,
  phase,
  sichten,
  regel,
  tage,
}: {
  einrichtung: Einrichtung;
  /** Das aktuelle Wechseljahr des Reiters. */
  jahr: Wechseljahr;
  /** Alle Jahre, die der Ferienkalender kennt (auch das vergangene Vorjahr). */
  jahre: readonly Wechseljahr[];
  ferien: readonly Sommerferien[];
  phase: Phase;
  sichten: readonly GruppenSicht[];
  /** Was in den Regeln von ChurchTools steht; `null` = man darf es nicht lesen (keine Spalte, keine Erinnerung). */
  regel: { art: 'laedt' } | RegelStand | null;
  tage: TageStand;
}) {
  // Das aktuelle Jahr und alle späteren – ein vergangenes zeigt die Seite nicht.
  const kuenftig = useMemo(() => jahre.filter((j) => j.jahr >= jahr.jahr), [jahre, jahr]);
  const hinweis = tageHinweis(tage, einrichtung.einstellung.ferienkalender);

  const nachricht = useMemo(() => leitungenNachricht(jahr, sichten), [jahr, sichten]);
  const feld = useRef<HTMLTextAreaElement>(null);
  const { stand, kopieren } = useKopieren(nachricht, feld);

  return (
    <>
      <div className={styles.kopf}>
        <h2>Wechseltage</h2>
        {/* Nur wenn die Regeln nachweislich reichen – sonst widerspräche die Zeile dem gelben Hinweis, und ohne
            das Recht (oder „nicht prüfbar“) wäre sie ein ungeprüftes Versprechen. */}
        {tage.art === 'ok' && (
          <span className={styles.leise}>nichts zu tun – ChurchTools verschiebt von selbst</span>
        )}
      </div>
      <p className={styles.leise}>
        Die Termine stehen für mehrere Jahre im Voraus fest. Am Ankündigungstag kommen die Kinder in
        die Wechsel-Liste, am Wechseltag in die neue Gruppe. Ausnahmen setzen die Leitungen in ihrer
        Gruppe.
      </p>
      {hinweis && (
        <Hinweis gelb>
          <b>{hinweis.titel}</b> {hinweis.text}
        </Hinweis>
      )}
      {regel?.art === 'nichtPruefbar' && (
        <Hinweis>
          Welche Wechseltage in den Regeln von ChurchTools stehen, ließ sich gerade nicht prüfen. Es
          wurde nichts verändert.
        </Hinweis>
      )}
      <section className={`${styles.karte} ${styles.rahmen}`} aria-label="Wechseltage je Jahr">
        <table className={styles.tabelle}>
          <thead>
            <tr>
              <th scope="col">Jahr</th>
              <th scope="col">Sommerferien</th>
              <th scope="col">Ankündigung</th>
              <th scope="col">Wechseltag</th>
              <th scope="col">Stichtag</th>
              {regel && <th scope="col">In den Regeln</th>}
            </tr>
          </thead>
          <tbody>
            {kuenftig.map((j) => {
              const f = ferien.find((x) => x.jahr === j.jahr);
              return (
                <tr key={j.jahr}>
                  <td>
                    <b>{j.jahr}</b>
                  </td>
                  <td>{f ? `${tagPunkt(f.beginn)} – ${tagPunkt(f.ende)}` : '–'}</td>
                  <td>{tagPunkt(j.ankuendigung)}</td>
                  <td>
                    <b>{wechseltagText(j.wechseltag)}</b>
                  </td>
                  <td>{tagPunkt(j.stichtag)}</td>
                  {regel && (
                    <td>
                      <StatusChip regel={regel} jahr={j.jahr} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className={styles.karte} aria-label="Leitungen Bescheid geben">
        <h3 className={styles.abschnitt}>Leitungen Bescheid geben</h3>
        <div className={styles.bescheid}>
          {phase === 'angekuendigt' ? (
            <>
              <p className={styles.leise}>
                ChurchTools schickt dazu keine Mail und keinen Push. Den Text kopieren und z. B. in
                die Leitungsgruppe schicken:
              </p>
              <textarea
                ref={feld}
                className={styles.textkopie}
                readOnly
                aria-label="Text für die Leitungen"
                value={nachricht}
                onFocus={(e) => e.target.select()}
              />
              <div className={styles.knopfzeile}>
                <FensterKnopf
                  art={stand === 'kopiert' ? 'hell' : 'zweit'}
                  onClick={() => void kopieren()}
                >
                  <Icon name={stand === 'kopiert' ? 'check' : 'dokument'} size={15} />
                  {stand === 'kopiert' ? 'Kopiert' : 'Text kopieren'}
                </FensterKnopf>
                <span className={styles.leise} role="status">
                  {stand === 'vonHand' ? 'Markiert – jetzt kopieren' : ''}
                </span>
              </div>
            </>
          ) : phase === 'ruhig' ? (
            <p className={styles.leise}>
              Ab der Ankündigung am {tagPunkt(jahr.ankuendigung)} steht hier ein Text, den du an die
              Leitungen schicken kannst.
            </p>
          ) : (
            <p className={styles.leise}>
              Der Wechsel läuft gerade – die Leitungen brauchen keinen Bescheid mehr.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/** Der Status eines Jahres in den Regeln von ChurchTools – eigene Farbe je Zustand, nie nur Farbe: immer auch Text. */
function StatusChip({ regel, jahr }: { regel: { art: 'laedt' } | RegelStand; jahr: number }) {
  const stand: JahrStand | undefined =
    regel.art === 'da' ? regel.staende.find((x) => x.jahr === jahr)?.stand : undefined;
  const [farbe, text] =
    regel.art === 'laedt'
      ? [styles.grau, 'wird geprüft']
      : !stand
        ? [styles.grau, 'nicht prüfbar']
        : stand.art === 'eingetragen'
          ? [styles.gruen, 'eingetragen']
          : stand.art === 'unvollstaendig'
            ? [styles.gelb, `unvollständig – fehlt bei ${stand.fehlend.join(', ')}`]
            : [styles.gelb, 'fehlt noch'];
  return <span className={`${styles.chip} ${farbe}`}>{text}</span>;
}
